import pytest

from app.config import Settings
from app.services.checkout_orders import CheckoutOrderService
from app.services.management import DomainError


def make_settings(**overrides):
    values = {
        'database_url': 'sqlite:///C:/temp/focusstore-flags-test.db',
        'FOCUS_DEBUG': True,
        'fastapi_checkout_enabled': True,
        'fastapi_payment_simulator_enabled': True,
        'catalog_source': 'postgresql',
        'checkout_write_authority': 'fastapi',
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize('mode', ['observe', 'shadow'])
def test_non_cutover_modes_never_authorize_fastapi_checkout(mode):
    with pytest.raises(DomainError, match='indisponível'):
        CheckoutOrderService(None, make_settings(migration_mode=mode))._ensure_enabled()


def test_prisma_authority_blocks_fastapi_even_in_cutover_mode():
    with pytest.raises(DomainError, match='indisponível'):
        CheckoutOrderService(None, make_settings(migration_mode='cutover', checkout_write_authority='prisma'))._ensure_enabled()


def test_simulator_is_not_a_production_provider():
    with pytest.raises(DomainError, match='provedor'):
        CheckoutOrderService(None, make_settings(migration_mode='cutover', FOCUS_DEBUG=False))._ensure_enabled()


def test_only_explicit_local_cutover_combination_authorizes_test_path():
    CheckoutOrderService(None, make_settings(migration_mode='cutover'))._ensure_enabled()
