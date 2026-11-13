"""Diagnostics are evidence for review, never automatic matching or authorization."""
from collections import Counter
from dataclasses import asdict, dataclass
from decimal import Decimal
import hashlib
import json
import unicodedata


def normalize(value: str | None) -> str:
    return unicodedata.normalize('NFKC', value or '').strip().casefold()


def money(value) -> str | None:
    return str(Decimal(str(value)).normalize()) if value is not None else None


@dataclass(frozen=True)
class VariantSnapshot:
    variant_id: str
    parent_id: str
    sku: str
    parent_sku: str | None
    attributes: dict[str, str | None]
    active: bool
    parent_active: bool
    price: str | None
    promotional_price: str | None
    available: int | None
    reserved: int | None
    normalized_sku_count: int

    def document(self) -> dict:
        result = asdict(self)
        # Stock and prices are mutable diagnostics, not shared authority or identity.
        identity = {k: v for k, v in result.items()
                    if k not in {'price', 'promotional_price', 'available', 'reserved'}}
        result['identity_hash'] = hashlib.sha256(
            json.dumps(identity, sort_keys=True, ensure_ascii=False).encode('utf-8')
        ).hexdigest()
        return result


@dataclass(frozen=True)
class Assessment:
    classification: str
    issues: tuple[str, ...] = ()
    differences: tuple[str, ...] = ()


def assess(prisma: VariantSnapshot | None, postgres: VariantSnapshot | None) -> Assessment:
    if prisma is None or postgres is None:
        return Assessment('absent', ('missing_variant_or_parent',))
    issues = []
    differences = tuple(field for field in ('price', 'promotional_price', 'available', 'reserved')
                        if getattr(prisma, field) != getattr(postgres, field))
    if not all((prisma.active, postgres.active, prisma.parent_active, postgres.parent_active)):
        issues.append('inactive_variant_or_parent')
    if not normalize(prisma.sku) or not normalize(postgres.sku):
        issues.append('missing_sku')
    if normalize(prisma.sku) != normalize(postgres.sku):
        issues.append('different_sku')
    for field in ('color', 'color_hex', 'size', 'model'):
        left, right = normalize(prisma.attributes.get(field)), normalize(postgres.attributes.get(field))
        if left and right and left != right:
            issues.append('different_' + field)
    if issues:
        return Assessment('incompatible', tuple(issues), differences)
    if prisma.normalized_sku_count != 1 or postgres.normalized_sku_count != 1:
        return Assessment('ambiguous', ('normalized_sku_collision',), differences)
    if (not normalize(prisma.parent_sku) or normalize(prisma.parent_sku) != normalize(postgres.parent_sku)
            or any(bool(normalize(prisma.attributes.get(k))) != bool(normalize(postgres.attributes.get(k)))
                   for k in ('color', 'color_hex', 'size', 'model'))):
        return Assessment('potential', ('parent_or_attributes_need_reconciliation',), differences)
    # "verifiable" means eligible for explicit human review, not verified.
    return Assessment('verifiable', (), differences)


def catalog_diagnostics(products: list[dict], variants: list[dict]) -> dict:
    """Aggregate catalog-only facts without PII or creating any links."""
    parent_ids = {str(p['id']) for p in products}
    with_variants = {str(v['product_id']) for v in variants}
    raw = Counter(v.get('sku') for v in variants)
    normalized = Counter(normalize(v.get('sku')) for v in variants)
    return {
        'products': len(products), 'variants': len(variants),
        'products_without_variants': len(parent_ids - with_variants),
        'orphan_variants': sum(str(v['product_id']) not in parent_ids for v in variants),
        'missing_sku': sum(not normalize(v.get('sku')) for v in variants),
        'duplicate_raw_skus': sum(count > 1 for count in raw.values()),
        'duplicate_normalized_skus': sum(count > 1 for count in normalized.values()),
        'normalization_changes': sum(v.get('sku') != normalize(v.get('sku')) for v in variants),
        'inactive_products': sum(p['status'] != 'ACTIVE' for p in products),
        'inactive_variants': sum(not v['is_active'] for v in variants),
    }
