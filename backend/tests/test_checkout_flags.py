import pytest

from app.config import Settings
from app.services.checkout_orders import CheckoutOrderService
from app.services.management import DomainError


def settings(**overrides):
    values = {
        'database_url': 'sqlite:///C:/temp/focusstore-flags-test.db',
        'FOCUS_DEBUG': True,
        'fastapi_checkout_enabled': True,
        'fastapi_payment_simulator_enabled': True,
        'catalog_source': 'postgresql',
    }
    values.update(overrides)
    return Settings(**values)


def test_fastapi_checkout_requires_debug_for_test_provider():
    with pytest.raises(DomainError, match='provedor'):
        CheckoutOrderService(None, settings(FOCUS_DEBUG=False))._ensure_enabled()


def test_default_checkout_is_disabled():
    with pytest.raises(DomainError, match='indisponível'):
        CheckoutOrderService(None, Settings(database_url='sqlite:///C:/temp/focusstore-flags-test.db'))._ensure_enabled()
