# Integração contínua

O workflow frontend executa em pushes e pull requests para `main`, `back-end` e `banco-de-dados`, além de acionamento manual, sem deploy. Ele chama o workflow backend reutilizável. O token tem apenas `contents: read` e o checkout não persiste credenciais.

## Frontend e full-stack

O workflow de frontend usa Node 22 e `npm ci`. Gera o Prisma Client, executa TypeScript, lint, testes unitários e integração de loja, autenticação e administração. O build usa um SQLite criado no runner. O job full-stack depende do frontend e do backend, instala Python 3.13 e executa `npm run test:fullstack`.

As fixtures de integração criam arquivos SQLite exclusivos em diretórios temporários. O full-stack usa um banco SQLite separado para o frontend e outro arquivo como fonte de catálogo legado. Seu endereço PostgreSQL é deliberadamente inacessível.

## Backend e PostgreSQL

O workflow backend usa Python 3.13 e dependências fixadas. O job SQLite executa os testes independentes de PostgreSQL. Três arquivos que incluem testes PostgreSQL são excluídos desse job e executados integralmente no job PostgreSQL. O job PostgreSQL usa PostgreSQL 18 como serviço descartável. O banco `focusstore_integration_test`, a role de CI e a porta 5433 passam pelo guard existente. A senha pertence exclusivamente ao contêiner efêmero de CI e não dá acesso a ambiente comercial. Antes de migrations, uma verificação exige GitHub Actions e valida a identidade efetiva da conexão e a versão do servidor.

O job executa Alembic, comparação de modelos, pytest, verificação de testes ignorados, integridade e OpenAPI. O relatório JUnit do backend é armazenado por sete dias. O resultado de cada etapa fica nos logs do job.

## Limitações e reprodução

O full-stack depende dos jobs frontend e backend. O job `full-validation` sempre verifica os resultados de frontend, backend e full-stack, e falha se algum deles não tiver resultado `success`. A execução remota ainda não foi comprovada. O backend reutilizável contém os jobs SQLite e PostgreSQL.

Para reproduzir o frontend, selecione Node 22, execute `npm ci`, `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm test` e `npm run test:integration`. Para o full-stack, instale também `backend/requirements.txt` e execute `npm run test:fullstack`. As suítes de integração e full-stack apresentaram falhas locais que continuam visíveis e bloqueiam aprovação.

Para o backend, use um cluster PostgreSQL descartável que atenda a `backend/tests/postgres_test_guard.py`, configure `DATABASE_URL` e `TEST_DATABASE_URL` somente para ele e execute, em `backend`, `python -m alembic upgrade head`, `python -m alembic check` e `python -m pytest -q -ra`. A suíte contém testes com fixtures SQLite e testes PostgreSQL reais. Testes ausentes de outbox e reservas não podem ser inferidos pelo nome do job.

Os relatórios anteriores do projeto não foram substituídos. O histórico da integração e o commit `7589b0a6365c30c73d9ef7d08e2714b621c9b119` precisam ser recuperados de um clone ou backup confiável.

Na auditoria local da Fase 10.1, geração Prisma, TypeScript, lint e os nove testes unitários frontend passaram. A integração frontend teve 20 testes aprovados e 15 falhas, e o full-stack teve cinco falhas. A suíte backend sem PostgreSQL teve 169 aprovados e 9 ignorados. Na Fase 10, o cluster PostgreSQL descartável executou migrations, `alembic check` e 178 testes com sucesso. Os dois workflows passaram no `actionlint` 1.7.7 e no parser YAML. O build compilou, mas retornou erro de segurança do Next.js. Nenhum desses resultados comprova execução no GitHub Actions.
