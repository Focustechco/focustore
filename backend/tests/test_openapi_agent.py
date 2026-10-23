import copy
import json

import pytest

from app.agents import openapi_check as agent


def test_reference_matches_native_schema():
    schema = json.loads(agent.generated())
    assert '/health' in schema['paths']
    assert '/categories' in schema['paths']
    assert agent.generated() == agent.generated()
    assert json.loads(agent.SNAPSHOT.read_text(encoding='utf-8')) == schema


@pytest.mark.parametrize('section', ['route', 'parameter', 'schema', 'response', 'required', 'security'])
def test_contract_changes_are_reported(section):
    old = {'paths': {'/items': {'get': {'parameters': [{'name': 'q', 'required': False}], 'responses': {'200': {'description': 'ok'}}}}},
           'components': {'schemas': {'Item': {'type': 'object', 'properties': {'id': {'type': 'integer'}}}}}}
    new = copy.deepcopy(old)
    if section == 'route':
        del new['paths']['/items']
    elif section == 'parameter':
        new['paths']['/items']['get']['parameters'][0]['required'] = True
    elif section == 'schema':
        new['components']['schemas']['Item']['properties']['id']['type'] = 'string'
    elif section == 'response':
        del new['paths']['/items']['get']['responses']['200']
    elif section == 'required':
        new['components']['schemas']['Item']['required'] = ['id']
    else:
        new['security'] = [{'token': []}]
    report = agent.changes(old, new)
    assert report and any('BREAKING' in line or 'REVIEW' in line for line in report)


def test_additive_route_and_key_order():
    assert agent.changes({'a': 1, 'b': 2}, {'b': 2, 'a': 1}) == []
    assert 'ADDED' in agent.changes({'paths': {}}, {'paths': {'/new': {}}})[0]


def test_check_never_updates_reference(monkeypatch, tmp_path, capsys):
    path = tmp_path / 'openapi.json'
    path.write_text('{}', encoding='utf-8')
    monkeypatch.setattr(agent, 'SNAPSHOT', path)
    assert agent.main([]) == 1
    assert path.read_text() == '{}'
    assert 'FAIL' in capsys.readouterr().out
    path.write_text('{broken', encoding='utf-8')
    assert agent.main([]) == 1
    path.unlink()
    assert agent.main([]) == 1


def test_intentional_update_and_ci_guard(monkeypatch, tmp_path):
    path = tmp_path / 'openapi.json'
    monkeypatch.setattr(agent, 'SNAPSHOT', path)
    monkeypatch.delenv('CI', raising=False)
    monkeypatch.delenv('GITHUB_ACTIONS', raising=False)
    assert agent.main(['--write']) == 0
    assert agent.main([]) == 0
    before = path.read_bytes()
    monkeypatch.setenv('CI', 'true')
    assert agent.main(['--write']) == 1
    assert path.read_bytes() == before


def test_generation_error_does_not_expose_secrets(monkeypatch, capsys):
    def fail():
        raise RuntimeError('secret-password')
    monkeypatch.setattr(agent, 'generated', fail)
    assert agent.main([]) == 1
    assert 'secret-password' not in capsys.readouterr().out
