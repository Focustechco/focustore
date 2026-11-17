"""Validate E2E destinations without opening any database connections."""
import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    'catalog_e2e_database', Path(__file__).resolve().parents[2] / 'scripts/catalog_e2e_database.py')
safety = importlib.util.module_from_spec(spec)
spec.loader.exec_module(safety)
RUN_ID = 'a' * 32


@pytest.mark.parametrize('raw', [
    'sqlite:///local_test',
    'postgresql+psycopg://user@remote:5432/catalog_test',
    'postgresql+psycopg://user@localhost:5432/production',
    'postgresql+psycopg://user@localhost/catalog_test',
    'postgresql+psycopg://user@localhost:5432/catalog_test?options=-csearch_path=public',
])
def test_reject_unsafe_base_destination(raw):
    with pytest.raises(ValueError):
        safety.validated_url(raw)


@pytest.mark.parametrize('run_id', ['', 'short', 'A' * 32, 'a' * 31 + '"'])
def test_reject_missing_or_invalid_run_identity(run_id):
    with pytest.raises(ValueError):
        safety.owned_name(run_id)


def test_seed_requires_exact_run_owned_database():
    with pytest.raises(ValueError):
        safety.validate_owned_url('postgresql+psycopg://user@localhost:5432/catalog_test', RUN_ID)
    expected = safety.owned_name(RUN_ID)
    assert safety.validate_owned_url(
        f'postgresql+psycopg://user@localhost:5432/{expected}', RUN_ID).database == expected
