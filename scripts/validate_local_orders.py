"""Validate the approved local orders flow through Next.js and FastAPI.

This script intentionally creates one synthetic customer and one synthetic order.
It never runs migrations and never reads backend/.env.
"""

from __future__ import annotations

import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
from decimal import Decimal

from sqlalchemy import create_engine, text


LOCAL_HOST = '127.0.0.1'
LOCAL_PORT = 5432
LOCAL_DB = 'focusstore_test'
LOCAL_USER = 'postgres'
SCHEMA = 'public'
TEST_EMAIL = 'orders-validation@example.test'
FRONTEND = 'http://127.0.0.1:3000'
BACKEND = 'http://127.0.0.1:8000'
ORIGIN = FRONTEND
HTTP_TIMEOUT_SECONDS = 5
PREFLIGHT_ATTEMPTS = 2
PREFLIGHT_DELAY_SECONDS = 1


def fail(message: str) -> None:
    print(f'FAIL: {message}', file=sys.stderr)
    raise SystemExit(1)


def describe_network_error(error: BaseException) -> str:
    reason = getattr(error, 'reason', error)
    message = str(reason).lower()
    if isinstance(reason, TimeoutError) or 'timed out' in message or 'timeout' in message:
        return 'timeout'
    if isinstance(reason, ConnectionRefusedError) or 'refused' in message:
        return 'conexão recusada (serviço provavelmente desligado)'
    if isinstance(reason, socket.gaierror) or 'name or service not known' in message:
        return 'falha DNS'
    return f'erro de rede ({type(reason).__name__})'


def probe(url: str) -> tuple[bool, str]:
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            return True, f'HTTP {response.status}'
    except urllib.error.HTTPError as error:
        return False, f'HTTP {error.code}'
    except (urllib.error.URLError, TimeoutError) as error:
        return False, describe_network_error(error)


def preflight() -> None:
    checks = (
        (f'{BACKEND}/health', 'FastAPI /health'),
        (f'{BACKEND}/api/v1/catalog/products?offset=0&limit=1', 'FastAPI catálogo'),
        (FRONTEND, 'Next.js raiz'),
    )
    for url, label in checks:
        last_detail = 'sem resposta'
        for attempt in range(PREFLIGHT_ATTEMPTS):
            ok, detail = probe(url)
            if ok:
                print(f'PASS: {label} ({url}): {detail}')
                break
            last_detail = detail
            if attempt + 1 < PREFLIGHT_ATTEMPTS:
                time.sleep(PREFLIGHT_DELAY_SECONDS)
        else:
            fail(f'{label} indisponível em {url}: {last_detail}. '
                 'Inicie os serviços em outro PowerShell com '
                 '.\\scripts\\start-focusstore-local.ps1 e execute este validador novamente.')


def request_json(url: str, *, method: str = 'GET', payload=None, cookies: dict[str, str] | None = None):
    body = None if payload is None else json.dumps(payload).encode('utf-8')
    headers = {'Accept': 'application/json', 'Origin': ORIGIN}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if cookies:
        headers['Cookie'] = '; '.join(f'{key}={value}' for key, value in cookies.items())
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            raw = response.read().decode('utf-8')
            return response.status, json.loads(raw) if raw else {}, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read().decode('utf-8', errors='replace')
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {'detail': 'Resposta HTTP sem JSON'}
        return error.code, payload, dict(error.headers)
    except (urllib.error.URLError, TimeoutError) as error:
        fail(f'endpoint local indisponível em {url}: {describe_network_error(error)}.')


def cookie_from_headers(headers: dict[str, str]) -> dict[str, str]:
    value = headers.get('Set-Cookie') or headers.get('set-cookie')
    if not value:
        return {}
    first = value.split(';', 1)[0]
    name, separator, token = first.partition('=')
    return {name: token} if separator and name == 'focus_session' and token else {}


def validate_database(engine) -> tuple[int, int, tuple[int, int], str | None]:
    with engine.connect() as connection:
        identity = connection.execute(text(
            "SELECT inet_server_addr(), inet_server_port(), current_database(), "
            "current_user, current_schema()"
        )).one()
        if str(identity[0]) != LOCAL_HOST or identity[1] != LOCAL_PORT or identity[2] != LOCAL_DB:
            fail('a identidade efetiva do PostgreSQL não corresponde ao destino local autorizado.')
        if identity[3] != LOCAL_USER or identity[4] != SCHEMA:
            fail('usuário ou schema efetivo não corresponde ao destino autorizado.')

        revision = connection.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one_or_none()
        if revision != 'c9d0e1f2a3b4':
            fail(f'revisão Alembic inesperada: {revision!r}. Esperada: c9d0e1f2a3b4.')

        tables = {
            row[0] for row in connection.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items')"
            ))
        }
        if tables != {'orders', 'order_items'}:
            fail('as tabelas orders e order_items não estão presentes no schema public.')

        required_columns = [
            (row[0], row[1])
            for row in connection.execute(text(
                "SELECT table_name, column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items')"
            ))
        ]
        expected = {
            'orders': {'id', 'user_id', 'order_number', 'status', 'currency', 'subtotal', 'total', 'idempotency_key'},
            'order_items': {'id', 'order_id', 'product_id', 'variant_id', 'product_name', 'variant_name',
                            'sku', 'quantity', 'unit_price', 'subtotal'},
        }
        for table, columns in expected.items():
            actual = {column for (table_name, column) in required_columns if table_name == table}
            if not columns.issubset(actual):
                fail(f'campos obrigatórios ausentes em {table}.')

        foreign_keys = {
            (row[0], row[1], row[2], row[3])
            for row in connection.execute(text(
                "SELECT tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name "
                "FROM information_schema.table_constraints tc "
                "JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name "
                "AND tc.table_schema = kcu.table_schema "
                "JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name "
                "AND ccu.table_schema = tc.table_schema "
                "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' "
                "AND tc.table_name IN ('orders', 'order_items')"
            ))
        }
        expected_foreign_keys = {
            ('orders', 'user_id', 'users', 'id'),
            ('order_items', 'order_id', 'orders', 'id'),
            ('order_items', 'product_id', 'products', 'id'),
            ('order_items', 'variant_id', 'product_variants', 'id'),
        }
        if not expected_foreign_keys.issubset(foreign_keys):
            fail('os relacionamentos obrigatórios das tabelas de pedidos estão incompletos.')

        before_orders = connection.execute(text('SELECT count(*) FROM public.orders')).scalar_one()
        existing_order_id = connection.execute(text(
            'SELECT id FROM public.orders WHERE idempotency_key = :key'
        ), {'key': 'orders-validation-single-order-v1'}).scalar_one_or_none()
        variant = connection.execute(text(
            "SELECT v.id, i.quantity_available, i.quantity_reserved "
            "FROM public.product_variants v "
            "JOIN public.products p ON p.id = v.product_id "
            "JOIN public.inventory i ON i.variant_id = v.id "
            "WHERE v.is_active IS TRUE AND p.status = 'ACTIVE' "
            "AND (i.quantity_available - i.quantity_reserved) > 0 "
            "ORDER BY v.id LIMIT 1"
        )).one_or_none()
        if variant is None:
            fail('nenhuma variante ativa com estoque disponível foi encontrada.')
        return before_orders, int(variant[0]), (int(variant[1]), int(variant[2])), existing_order_id


def main() -> int:
    database_url = os.environ.get('DATABASE_URL', '')
    if not database_url:
        fail('DATABASE_URL local não foi fornecida pelo script PowerShell.')
    engine = create_engine(database_url, hide_parameters=True, pool_pre_ping=True)
    before_orders, variant_id, stock_before, existing_order_id = validate_database(engine)
    print('PASS: PostgreSQL local, migration, tabelas, chaves e estoque inicial validados.')
    print('Executando preflight HTTP antes de criar a conta ou o pedido...')
    preflight()

    catalog_status, catalog, _ = request_json(f'{BACKEND}/api/v1/catalog/products?offset=0&limit=100')
    if catalog_status != 200 or catalog.get('total') != 19:
        fail(f'catálogo local inesperado: HTTP {catalog_status}, total={catalog.get("total")!r}.')
    if not any(str(variant.get('id')) == str(variant_id) and variant.get('available') for product in catalog.get('items', []) for variant in product.get('variants', [])):
        fail('a variante escolhida no PostgreSQL não foi retornada como disponível pela FastAPI.')

    email = os.environ.get('FOCUS_TEST_ACCOUNT_EMAIL', TEST_EMAIL)
    password = os.environ.get('FOCUS_TEST_ACCOUNT_PASSWORD')
    if not password:
        fail('senha da conta fictícia não foi fornecida pelo PowerShell.')
    register_status, _registered, register_headers = request_json(
        f'{FRONTEND}/api/auth/register', method='POST',
        payload={'name': 'Orders Validation', 'email': email, 'password': password},
    )
    if register_status == 409:
        register_status, _registered, register_headers = request_json(
            f'{FRONTEND}/api/auth/login', method='POST',
            payload={'email': email, 'password': password},
        )
        if register_status != 200:
            fail(f'login da conta fictícia existente falhou: HTTP {register_status}.')
    elif register_status != 201:
        fail(f'cadastro da conta fictícia falhou: HTTP {register_status}.')
    cookies = cookie_from_headers(register_headers)
    if not cookies:
        fail('o cadastro não retornou cookie de sessão PostgreSQL.')

    idempotency_key = 'orders-validation-single-order-v1'
    order_payload = {
        'items': [{'variantId': str(variant_id), 'quantity': 1}],
        'idempotencyKey': idempotency_key,
    }
    create_status, created, create_headers = request_json(
        f'{FRONTEND}/api/orders', method='POST', payload=order_payload, cookies=cookies
    )
    if create_status != 201:
        detail = created.get('detail') or created.get('error') or 'resposta sem detalhe seguro'
        correlation = create_headers.get('x-focus-correlation-id', 'não informado')
        fail(f'criação do pedido falhou em POST {FRONTEND}/api/orders: '
             f'HTTP {create_status}; etapa=FastAPI/serviço de pedidos; '
             f'detail={detail!r}; correlação={correlation}.')
    if created.get('status') != 'PENDING_PAYMENT':
        fail('o pedido não recebeu status PENDING_PAYMENT.')
    order_id = created.get('id')
    if not order_id or created.get('items', [{}])[0].get('quantity') != 1:
        fail('a resposta do pedido não contém o item esperado.')

    replay_status, replay, _ = request_json(f'{FRONTEND}/api/orders', method='POST', payload=order_payload, cookies=cookies)
    if replay_status != 201 or replay.get('id') != order_id:
        fail('a repetição com a mesma chave de idempotência não retornou o pedido original.')

    history_status, history, _ = request_json(f'{BACKEND}/api/v1/orders', cookies=cookies)
    detail_status, detail, _ = request_json(f'{BACKEND}/api/v1/orders/{order_id}', cookies=cookies)
    if history_status != 200 or detail_status != 200:
        fail(f'consulta do histórico falhou: lista={history_status}, detalhe={detail_status}.')
    if not any(item.get('id') == order_id for item in history.get('items', [])) or detail.get('id') != order_id:
        fail('o pedido criado não foi encontrado no histórico do próprio cliente.')

    with engine.connect() as connection:
        after_orders = connection.execute(text('SELECT count(*) FROM public.orders')).scalar_one()
        stored = connection.execute(text(
            'SELECT status, subtotal, total FROM public.orders WHERE id = :id'
        ), {'id': order_id}).one_or_none()
        item_count = connection.execute(text(
            'SELECT count(*) FROM public.order_items WHERE order_id = :id'
        ), {'id': order_id}).scalar_one()
        stock_after = connection.execute(text(
            'SELECT quantity_available, quantity_reserved FROM public.inventory WHERE variant_id = :id'
        ), {'id': variant_id}).one()
    expected_orders = before_orders if existing_order_id else before_orders + 1
    if after_orders != expected_orders or stored is None or item_count != 1:
        fail('a persistência do pedido ou item não corresponde ao esperado.')
    if stored[0] != 'PENDING_PAYMENT' or Decimal(str(stored[1])) != Decimal(str(created['subtotal'])):
        fail('os valores persistidos não correspondem ao cálculo retornado pelo servidor.')
    if tuple(map(int, stock_after)) != stock_before:
        fail('o estoque foi alterado durante a criação do pedido.')

    print('PASS: PostgreSQL local validado em 127.0.0.1:5432/focusstore_test/public.')
    print('PASS: migration c9d0e1f2a3b4 e tabelas orders/order_items confirmadas.')
    action = 'reutilizado por idempotência' if existing_order_id else 'criado'
    print(f'PASS: pedido fictício {action} com status PENDING_PAYMENT; pedidos antes/depois={before_orders}/{after_orders}.')
    print('PASS: item persistido, histórico consultado, idempotência confirmada e estoque inalterado.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
