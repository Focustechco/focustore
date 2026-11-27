"""Static migration inventory and read-only PostgreSQL verification for the disposable smoke."""
import ast
import hashlib
from pathlib import Path

from sqlalchemy import inspect, text

EXPECTED_REVISION = 'f6b7c8d9e0f1'
VERSIONS = Path(__file__).resolve().parents[1] / 'migrations' / 'versions'
HASHES = {
    '7ec8ee7c05e5_create_categories_table.py': '1b01f2740fb8f3e5df31b6d462c0578bbf8ba597981e62ccd1ed1a0a899972e4',
    'b24f91c73a60_create_categories_after_empty_revision.py': '2ec58fe48f54163a3e28553fbc18e3fcb213c957ae685f96a029f448f9724e1c',
    'e0dd9a760a45_create_products_table.py': '80cb1781f0ab854ffe11198a53873e1eb06768980267cabefe483787c805ff6a',
    'f4a1d2e3c4b5_expand_catalog_tables.py': '440e624b479de3abd71da9712d9db3209aea7100df2faea6f4694664108d7c56',
    'a7b8c9d0e1f2_add_product_base_price_constraint.py': '4ff01363df3100184d23ce702d0425b177574582a97b76a6868ea09fde8edc5f',
    'd1e2f3a4b5c6_add_catalog_public_ids.py': '58386a6820120639565372d1d915a1b149931d09e9a5073179110894bb2923eb',
    'e2f3a4b5c6d7_add_catalog_mapping.py': 'd25c7af2f4db4731d8aeff66f58740fc1db4cc455898bd9386396d9beda40a1e',
    'f5a6b7c8d9e0_add_transactional_inventory_reservations.py': 'e6222c388c370752951e7fdb5e714f8d495108a391bbb37fb1d765e9d8ea5299',
    'f6b7c8d9e0f1_add_postgres_checkout_orders.py': 'cac08f3e3ea7c5ef77f11bc342b2338e1a433f99f40f99121a2c8485d6b59b54',
}
FUNCTIONS = {'focusstore_prevent_catalog_public_id_change', 'mapping_prevent_history_change',
             'mapping_guard_write', 'mapping_record_state_event', 'mapping_guard_event_insert',
             'focusstore_inventory_history_guard'}
TRIGGERS = {'products_public_id_immutable', 'product_variants_public_id_immutable', 'mapping_guard',
            'mapping_state_event', 'mapping_event_insert', 'catalog_variant_mappings_preserve',
            'catalog_variant_mappings_no_truncate', 'catalog_mapping_events_preserve',
            'catalog_mapping_events_no_truncate', 'inventory_movements_preserve'}


class SchemaVerificationError(RuntimeError):
    def __init__(self, code):
        super().__init__('Commercial schema verification failed.')
        self.code = code


def _keyword(call, name, default=None):
    return next((item.value for item in call.keywords if item.arg == name), default)


def _literal(node, default=None):
    return node.value if isinstance(node, ast.Constant) else default


def _column(call):
    name = _literal(call.args[0])
    typ = call.args[1]
    if isinstance(typ, ast.Name) and typ.id in {'DOCUMENT', 'PUBLIC_ID'}:
        kind = 'JSONB' if typ.id == 'DOCUMENT' else 'UUID'
    elif isinstance(typ, ast.Call) and isinstance(typ.func, ast.Attribute):
        name_type = typ.func.attr
        args = [_literal(arg) for arg in typ.args]
        length = _literal(_keyword(typ, 'length')) or (args[0] if args else None)
        if name_type == 'String': kind = 'VARCHAR(' + str(length) + ')'
        elif name_type == 'Integer': kind = 'INTEGER'
        elif name_type == 'Text': kind = 'TEXT'
        elif name_type == 'Boolean': kind = 'BOOLEAN'
        elif name_type == 'Uuid': kind = 'UUID'
        elif name_type == 'DateTime': kind = 'TIMESTAMP WITH TIME ZONE' if _literal(_keyword(typ, 'timezone'), False) else 'TIMESTAMP WITHOUT TIME ZONE'
        elif name_type == 'Numeric':
            precision = _literal(_keyword(typ, 'precision')) or (args[0] if args else None)
            scale = _literal(_keyword(typ, 'scale')) if _keyword(typ, 'scale') else (args[1] if len(args) > 1 else None)
            kind = f'NUMERIC({precision},{scale})'
        else: raise SchemaVerificationError('MANIFEST_UNSUPPORTED')
    else:
        raise SchemaVerificationError('MANIFEST_UNSUPPORTED')
    primary = _literal(_keyword(call, 'primary_key'), False)
    nullable = _literal(_keyword(call, 'nullable'), not primary)
    default = _keyword(call, 'server_default')
    if default is not None:
        if isinstance(default, ast.Constant):
            default = str(default.value)
        else:
            default = {'sa.false()': 'false', 'sa.true()': 'true', 'sa.func.now()': 'now()',
                       '_timestamp_default()': 'now()'}.get(ast.unparse(default))
            if default is None:
                raise SchemaVerificationError('MANIFEST_UNSUPPORTED')
    return name, (kind, nullable, default)


def inventory():
    """Parse fixed, hash-pinned source as data; never import or execute migrations."""
    if {p.name for p in VERSIONS.glob('*.py')} != set(HASHES):
        raise SchemaVerificationError('MIGRATION_INVENTORY_CHANGED')
    tables, indexes, checks, foreign, unique = {}, {}, {}, {}, {}
    for filename, digest in HASHES.items():
        source = (VERSIONS / filename).read_bytes()
        if hashlib.sha256(source).hexdigest() != digest:
            raise SchemaVerificationError('MIGRATION_INVENTORY_CHANGED')
        tree = ast.parse(source.decode('utf-8'))
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                    and isinstance(node.func.value, ast.Name) and node.func.value.id == 'op' and node.args):
                continue
            action, table = node.func.attr, _literal(node.args[0])
            if action == 'create_table' and table:
                columns = {}
                checks[table], foreign[table], unique[table] = set(), set(), set()
                for item in node.args[1:]:
                    if not (isinstance(item, ast.Call) and isinstance(item.func, ast.Attribute)):
                        continue
                    kind = item.func.attr
                    if kind == 'Column':
                        key, value = _column(item)
                        columns[key] = value
                    elif kind == 'CheckConstraint':
                        checks[table].add(_literal(_keyword(item, 'name')))
                    elif kind == 'ForeignKeyConstraint':
                        src, dst = ast.literal_eval(item.args[0]), ast.literal_eval(item.args[1])
                        foreign[table].add((tuple(src), tuple(dst), _literal(_keyword(item, 'ondelete'))))
                    elif kind == 'UniqueConstraint':
                        unique[table].add(tuple(ast.literal_eval(arg) for arg in item.args))
                tables[table] = columns
            elif action == 'add_column' and table and isinstance(node.args[1], ast.Call):
                key, value = _column(node.args[1])
                tables[table][key] = value
            elif action == 'create_index' and table:
                indexes[table] = (_literal(node.args[1]), tuple(ast.literal_eval(node.args[2])),
                                  _literal(_keyword(node, 'unique'), False))
    for table in ('products', 'product_variants'):
        tables[table]['public_id'] = ('UUID', False, None)
        unique[table].add(('public_id',))
    foreign['categories'].add((('parent_id',), ('categories.id',), 'SET NULL'))
    checks['products'].add('ck_products_base_price_nonnegative')
    indexes['uq_mapping_active_prisma'] = ('catalog_variant_mappings', ('prisma_source', 'prisma_variant_id'), True)
    indexes['uq_mapping_active_postgres'] = ('catalog_variant_mappings', ('postgres_variant_public_id',), True)
    return tables, indexes, checks, foreign, unique


def verify_initial(connection):
    inspector = inspect(connection)
    if (inspector.get_table_names(schema='public') or inspector.get_view_names(schema='public')
            or inspector.get_sequence_names(schema='public')
            or connection.execute(text("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')")).scalar_one()
            or connection.execute(text("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")).scalar_one()):
        raise SchemaVerificationError('INITIAL_SCHEMA_NOT_EMPTY')


def verify_revision(observed):
    if observed != EXPECTED_REVISION:
        raise SchemaVerificationError('REVISION_MISMATCH')


def verify_structure(connection):
    tables, indexes, checks, foreign, unique = inventory()
    inspector = inspect(connection)
    actual_tables = set(inspector.get_table_names(schema='public'))
    if actual_tables != set(tables) | {'alembic_version'}:
        raise SchemaVerificationError('TABLES_MISMATCH')
    found_indexes = {}
    for table, expected in tables.items():
        columns = {column['name']: column for column in inspector.get_columns(table, schema='public')}
        if set(columns) != set(expected):
            raise SchemaVerificationError('COLUMNS_MISMATCH')
        for name, (kind, nullable, default) in expected.items():
            col = columns[name]
            actual_type = str(col['type'].compile(dialect=connection.dialect)).upper().replace(' ', '')
            if actual_type != kind.replace(' ', '') or bool(col['nullable']) != nullable:
                raise SchemaVerificationError('COLUMN_DEFINITION_MISMATCH')
            if default is not None:
                actual_default = str(col.get('default') or '').split('::', 1)[0].strip(" ()'")
                expected_default = default.strip(' ()')
                if actual_default != expected_default:
                    raise SchemaVerificationError('COLUMN_DEFAULT_MISMATCH')
        pk = inspector.get_pk_constraint(table, schema='public')['constrained_columns']
        if pk != (['product_id', 'category_id'] if table == 'product_categories' else ['id']):
            raise SchemaVerificationError('PRIMARY_KEY_MISMATCH')
        fks = inspector.get_foreign_keys(table, schema='public')
        if any(fk.get('referred_schema') not in (None, 'public') for fk in fks):
            raise SchemaVerificationError('FOREIGN_KEY_MISMATCH')
        actual_fk = {(tuple(fk['constrained_columns']), tuple(fk['referred_table'] + '.' + col for col in fk['referred_columns']),
                      fk.get('options', {}).get('ondelete')) for fk in fks}
        if actual_fk != foreign[table]:
            raise SchemaVerificationError('FOREIGN_KEY_MISMATCH')
        actual_unique = {tuple(item['column_names']) for item in inspector.get_unique_constraints(table, schema='public')}
        if not unique[table].issubset(actual_unique):
            raise SchemaVerificationError('UNIQUE_CONSTRAINT_MISMATCH')
        if not checks[table].issubset({item['name'] for item in inspector.get_check_constraints(table, schema='public')}):
            raise SchemaVerificationError('CHECK_CONSTRAINT_MISMATCH')
        for item in inspector.get_indexes(table, schema='public'):
            found_indexes[item['name']] = (table, tuple(item['column_names']), bool(item['unique']), item.get('dialect_options', {}))
    for name, definition in indexes.items():
        actual = found_indexes.get(name)
        if actual is None or actual[:3] != definition:
            raise SchemaVerificationError('INDEX_MISMATCH')
        if name in {'uq_mapping_active_prisma', 'uq_mapping_active_postgres'}:
            predicate = str(actual[3].get('postgresql_where', ''))
            if not all(word in predicate for word in ('state', 'candidate', 'verified')):
                raise SchemaVerificationError('INDEX_PREDICATE_MISMATCH')
    sequence_tables = set(tables) - {'product_categories'}
    for table in sequence_tables:
        if connection.execute(text("SELECT pg_get_serial_sequence(:name, 'id')"), {'name': 'public.' + table}).scalar_one() is None:
            raise SchemaVerificationError('SEQUENCE_MISSING')
    funcs = set(connection.execute(text("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND pg_get_userbyid(p.proowner)='focusstore_migrator'")).scalars())
    triggers = set(connection.execute(text("SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal")).scalars())
    if not FUNCTIONS.issubset(funcs) or not TRIGGERS.issubset(triggers):
        raise SchemaVerificationError('FUNCTION_OR_TRIGGER_MISSING')
    owners = set(connection.execute(text("SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S')")).scalars())
    if owners != {'focusstore_migrator'}:
        raise SchemaVerificationError('OWNER_MISMATCH')
