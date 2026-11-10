# FocusStore — CI do backend

## Objetivo

O workflow `Backend quality (no deploy)` valida o backend FastAPI em pull
requests e pushes relevantes, sem executar deploy, seed comercial, pagamento ou
acesso a ambientes externos.

## Eventos e escopo

- `pull_request` e `push` para `main` e `back-end`;
- somente quando houver alteração em `backend/**` ou no próprio workflow;
- `workflow_dispatch` permite execução manual;
- execuções concorrentes da mesma referência são canceladas quando uma nova
  execução começa;
- o job possui timeout de 12 minutos e `GITHUB_TOKEN` somente com
  `contents: read`.

## Ambiente

- runner `ubuntu-latest`;
- Python 3.13;
- PostgreSQL 18 em service container;
- banco fictício `focusstore_ci`, usuário `focusstore_ci` e senha exclusiva da
  execução, expostos somente no ambiente do job;
- porta do host `5433`, evitando o PostgreSQL protegido da porta 5432;
- `DATABASE_URL` e `TEST_DATABASE_URL` apontam explicitamente para
  `127.0.0.1:5433/focusstore_ci`;
- o health check aguarda `pg_isready` antes das migrations.

O nome do banco e a porta atendem ao `postgres_test_guard.py`: a CI não usa o
banco protegido `focusstore_test`, não usa a porta 5432 e não precisa enfraquecer
o guard para aceitar hosts ou bancos genéricos.

## Etapas do pipeline

1. checkout sem persistir credenciais;
2. setup do Python 3.13 com cache baseado em `backend/requirements.txt`;
3. instalação das dependências do backend;
4. `python -m pip check`;
5. instalação controlada de `pip-audit==2.10.1` e auditoria de requirements
   com transitivas via `python -m pip_audit -r requirements.txt --strict`;
6. `alembic upgrade head` somente no PostgreSQL descartável da execução;
7. `alembic check`;
8. suíte pytest com `-q -ra`, incluindo os testes PostgreSQL reais;
9. verificação explícita de skips inesperados;
10. agente de integridade PostgreSQL;
11. agente de contrato OpenAPI;
12. resumo do resultado no GitHub Actions.

Falhas de vulnerabilidade, dependência quebrada, migration, teste, integridade
ou OpenAPI fazem o job falhar. Nenhuma ferramenta executa `pip-audit --fix`.
Skips legítimos devem ser visíveis no relatório `-ra`; testes de integração
PostgreSQL falham em CI se `TEST_DATABASE_URL` não estiver configurada.

## Reprodução local equivalente

Com um PostgreSQL descartável local e uma URL aceita pelo guard:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://focusstore_ci:senha@127.0.0.1:5543/focusstore_ci'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
Set-Location backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pip install pip-audit==2.10.1
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --strict
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe -m pytest -q -ra
.\.venv\Scripts\python.exe -m app.agents.integrity
.\.venv\Scripts\python.exe -m app.agents.openapi_check
```

Não use credenciais reais nem a URL de `backend/.env`. Para a validação local
completa, crie um cluster descartável e remova-o ao final.

## Limitações e verificação remota

O arquivo prepara a CI, mas não prova uma execução no GitHub Actions. A
execução remota fica **NOT RUN** até que o workflow seja enviado ao GitHub por
um mantenedor autorizado. Depois, verifique o check `Backend quality (no deploy)`
na página do pull request ou em Actions, conferindo os logs de migrations,
pytest, pip-audit, integridade e OpenAPI, além do job summary.

O frontend, Prisma, SQLite legado, Supabase, deploy e produção não fazem parte
deste workflow.

## Validacao local desta configuracao

Em 2026-11-10, a configuracao foi validada localmente com:

- `actionlint` 1.7.7: workflow sem erros;
- `pip check`: `No broken requirements found`;
- `pip-audit` 2.10.1: `No known vulnerabilities found`;
- destino `postgresql+psycopg://focusstore_ci@127.0.0.1:5433/focusstore_ci`:
  aceito pelo guard como alvo descartavel;
- a suite PostgreSQL do backend ja havia sido executada no cluster descartavel
  da validacao anterior, com 178 testes aprovados, nenhum falho e nenhum skip.

Nao houve uma execucao remota no GitHub Actions apos esta alteracao. Portanto,
o estado da execucao real da CI e **NOT RUN**; a configuracao local e **PASS**.
