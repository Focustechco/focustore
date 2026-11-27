import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import Mock

import pytest

import test_integrity_agent
from postgres_guard import PostgresTestGuardError, authorize_test_target, validate_test_url


LOCAL_URL = 'postgresql+psycopg://focusstore_test:synthetic-password@127.0.0.1:55432/focusstore_integration_test'
LOCAL_ENV = {'FOCUS_TEST_POSTGRES_PROFILE': 'local', 'FOCUS_TEST_POSTGRES_AUTHORIZE': '1'}


@pytest.mark.parametrize('raw', [
    LOCAL_URL.replace('55432', '5432'),
    LOCAL_URL.replace('55432', '55433'),
    LOCAL_URL.replace('127.0.0.1', 'localhost'),
    LOCAL_URL.replace('127.0.0.1', '192.0.2.1'),
    LOCAL_URL.replace('focusstore_integration_test', 'other_test'),
    LOCAL_URL.replace('focusstore_test:', 'other:'),
    LOCAL_URL.replace('postgresql+psycopg', 'postgresql'),
    LOCAL_URL + '?host=192.0.2.1',
    LOCAL_URL + '?options=-csearch_path%3Dpublic',
    LOCAL_URL.replace('55432', 'invalid'),
    LOCAL_URL.replace(':synthetic-password', ''),
    '',
    'not a URL',
])
def test_rejects_unapproved_targets_and_parameters(raw):
    with pytest.raises(PostgresTestGuardError) as failure:
        validate_test_url(raw, LOCAL_ENV)
    assert 'synthetic-password' not in str(failure.value)


@pytest.mark.parametrize('env', [
    {},
    {'FOCUS_TEST_POSTGRES_AUTHORIZE': '1'},
    {'FOCUS_TEST_POSTGRES_PROFILE': 'local'},
    {**LOCAL_ENV, 'CI': 'true'},
    {**LOCAL_ENV, 'GITHUB_ACTIONS': 'true'},
    {**LOCAL_ENV, 'PGHOST': '192.0.2.1'},
    {**LOCAL_ENV, 'PGOPTIONS': '-csearch_path=public'},
])
def test_rejects_missing_authorization_and_conflicts(env):
    with pytest.raises(PostgresTestGuardError):
        validate_test_url(LOCAL_URL, env)


def test_structural_validation_never_authorizes_operations():
    assert validate_test_url(LOCAL_URL, LOCAL_ENV).port == 55432
    with pytest.raises(PostgresTestGuardError, match='operations are blocked'):
        authorize_test_target(LOCAL_URL, LOCAL_ENV)


def test_conflicting_inherited_database_is_rejected_without_disclosure():
    with pytest.raises(PostgresTestGuardError) as failure:
        validate_test_url(LOCAL_URL, LOCAL_ENV, inherited_database_url='postgresql://private:secret@127.0.0.1/db')
    assert 'secret' not in str(failure.value)


def test_ci_configuration_is_separate_and_still_blocked():
    ci_url = 'postgresql+psycopg://focusstore:synthetic-password@localhost:5432/focusstore_test'
    env = {'FOCUS_TEST_POSTGRES_PROFILE': 'ci', 'FOCUS_TEST_POSTGRES_AUTHORIZE': '1',
           'CI': 'true', 'GITHUB_ACTIONS': 'true'}
    assert validate_test_url(ci_url, env).port == 5432
    with pytest.raises(PostgresTestGuardError, match='operations are blocked'):
        authorize_test_target(ci_url, env)
    with pytest.raises(PostgresTestGuardError):
        authorize_test_target(LOCAL_URL, {'CI': 'true'})


@pytest.mark.parametrize('url, env', [
    (LOCAL_URL.replace('55432', '5432'), LOCAL_ENV),
    (LOCAL_URL, LOCAL_ENV),
])
def test_fixture_stops_before_engine_migration_or_drop(monkeypatch, url, env):
    monkeypatch.setenv('TEST_DATABASE_URL', url)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr(test_integrity_agent, 'inherited_database_url', None)
    engine = Mock(side_effect=AssertionError('unexpected engine'))
    migration = Mock(side_effect=AssertionError('unexpected migration'))
    monkeypatch.setattr(test_integrity_agent, 'create_engine', engine)
    monkeypatch.setattr(test_integrity_agent.command, 'upgrade', migration)
    fixture = test_integrity_agent.postgres.__wrapped__(monkeypatch)
    with pytest.raises(pytest.fail.Exception) as failure:
        next(fixture)
    assert 'synthetic-password' not in str(failure.value)
    engine.assert_not_called()
    migration.assert_not_called()


def test_fixture_never_falls_back_to_database_url(monkeypatch):
    monkeypatch.delenv('TEST_DATABASE_URL', raising=False)
    monkeypatch.delenv('CI', raising=False)
    monkeypatch.setenv('DATABASE_URL', 'postgresql://private:secret@127.0.0.1/existing_test')
    engine = Mock(side_effect=AssertionError('unexpected engine'))
    monkeypatch.setattr(test_integrity_agent, 'create_engine', engine)
    fixture = test_integrity_agent.postgres.__wrapped__(monkeypatch)
    with pytest.raises(pytest.skip.Exception):
        next(fixture)
    engine.assert_not_called()


def test_collection_ignores_inherited_database_and_env_file():
    backend = Path(__file__).resolve().parents[1]
    env = dict(os.environ, DATABASE_URL='postgresql+psycopg://private:synthetic-secret@127.0.0.1:5432/existing',
               PYTHONDONTWRITEBYTECODE='1', PYTHONPATH=str(backend / 'tests'))
    script = (
        "import conftest; from app.db.session import engine; from app.config import Settings; "
        "assert engine.url.get_backend_name() == 'sqlite' and engine.url.database == ':memory:'; "
        "assert Settings.model_config['env_file'] is None"
    )
    result = subprocess.run([sys.executable, '-c', script], cwd=backend, env=env, capture_output=True, text=True)
    assert result.returncode == 0
    assert 'synthetic-secret' not in result.stdout + result.stderr
