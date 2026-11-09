import pytest
from sqlalchemy.engine import make_url

from postgres_test_guard import safe_test_url, validate_identity


@pytest.mark.parametrize('raw', [
    'postgresql://focus_test_owner@127.0.0.1:5432/focusstore_test',
    'postgresql://focus_test_owner@127.0.0.1:55432/focusstore_test',
    'postgresql://postgres@127.0.0.1:55432/focusstore_itest',
    'postgresql://focus_test_owner@db.example:55432/focusstore_itest',
    'postgresql://focus_test_owner@127.0.0.1:55432/other_db',
])
def test_safe_test_url_rejects_unapproved_targets(raw):
    with pytest.raises(AssertionError):
        safe_test_url(raw)


def test_safe_test_url_accepts_named_disposable_target():
    url = safe_test_url('postgresql://focus_test_owner@127.0.0.1:55432/focusstore_itest')
    assert url.database == 'focusstore_itest'
    assert url.port == 55432


def test_validate_identity_rejects_protected_effective_identity():
    class Result:
        def one(self):
            return ('focusstore_test', 'postgres', '127.0.0.1/32', 5432, 'public')

    class Connection:
        def execute(self, statement):
            return Result()

    url = make_url('postgresql://focus_test_owner@127.0.0.1:55432/focusstore_itest')
    with pytest.raises(AssertionError):
        validate_identity(Connection(), url)
