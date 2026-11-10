# Testes de integração PostgreSQL

## Estratégia de isolamento

Os testes foram executados em um cluster PostgreSQL 18 descartável criado
localmente com `initdb` e `pg_ctl`, porque o daemon Docker não estava
disponível. O cluster:

- foi criado em diretório temporário exclusivo desta tarefa;
- escutou somente em `127.0.0.1:55432`;
- usou o banco `focusstore_itest`;
- usou o papel dedicado `focus_test_owner`;
- não reutilizou `focusstore_test`, porta 5432, Supabase ou SQLite;
- não teve volume persistente associado a outro projeto.

A identidade efetiva foi verificada antes das migrations:

```text
database=focusstore_itest
user=focus_test_owner
server=127.0.0.1/32
port=55432
schema=public
version=PostgreSQL 18.6
```

As fixtures agora usam [postgres_test_guard.py](./tests/postgres_test_guard.py)
para bloquear explicitamente banco protegido, porta 5432, hosts remotos,
usuário `postgres`, nomes não descartáveis e qualquer identidade efetiva
divergente antes de criar schema ou executar escrita.

## Migrations e schema

O banco descartável iniciou sem tabelas. Foram executadas as migrations
existentes, sem criar ou alterar migrations:

```text
 -> 7ec8ee7c05e5
7ec8ee7c05e5 -> b24f91c73a60
b24f91c73a60 -> e0dd9a760a45
e0dd9a760a45 -> f4a1d2e3c4b5
f4a1d2e3c4b5 -> a7b8c9d0e1f2
a7b8c9d0e1f2 -> b8c9d0e1f2a3
b8c9d0e1f2a3 -> c9d0e1f2a3b4
```

Resultado final:

- revisão Alembic: `c9d0e1f2a3b4`;
- 12 tabelas públicas, incluindo `alembic_version`;
- 114 constraints de chave, unicidade e validação;
- `alembic check`: PASS, sem operações pendentes;
- `app.agents.integrity`: PASS;
- usuários, produtos, pedidos e itens no schema público após os testes:
  `0|0|0|0`.

Durante a primeira validação foi encontrada uma divergência entre o modelo e a
migration: `orders.created_at` e `orders.updated_at` eram `TIMESTAMP WITH TIME
ZONE` no PostgreSQL, mas não tinham `timezone=True` no modelo SQLAlchemy. O
modelo foi corrigido em [order.py](./app/models/order.py), sem migration nova,
pois a migration existente já representava o tipo correto. Uma regressão foi
adicionada em [test_postgres_orders.py](./tests/test_postgres_orders.py).

## Testes executados

Testes PostgreSQL direcionados:

- autenticação, cadastro, login, logout, expiração e revogação;
- catálogo e geração de slugs;
- integridade e agente de schema;
- guardas contra banco/porta/host não autorizados;
- pedidos, snapshots, idempotência, isolamento e estoque;
- rollback e constraints.

Resultado direcionado após a correção: **21 passed, 0 failed**.

Suíte completa do backend com `TEST_DATABASE_URL` apontando exclusivamente para
o cluster descartável: **174 passed, 0 failed, 0 skipped**, com um warning de
depreciação do `starlette.testclient` relacionado ao `httpx`.

Também passaram:

- `alembic check`;
- agente de integridade PostgreSQL;
- verificação OpenAPI;
- `pip check`;
- compilação dos arquivos Python alterados.

## Reprodução

Com um cluster descartável já criado e validado, a execução deve usar somente
a URL do cluster de teste:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://focus_test_owner@127.0.0.1:55432/focusstore_itest'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
python -m alembic upgrade head
python -m alembic check
python -m pytest -q -ra
Remove-Item Env:TEST_DATABASE_URL, Env:DATABASE_URL -ErrorAction SilentlyContinue
```

O guard de testes rejeita URLs para `focusstore_test`, porta 5432, Supabase,
hosts não locais, papel `postgres` e bancos que não tenham nome descartável.
Credenciais não devem ser impressas ou gravadas no repositório.

## Limpeza e limites

O processo PostgreSQL e o diretório temporário usados nesta execução foram
criados exclusivamente para os testes e devem ser encerrados/removidos pelo
procedimento controlado da tarefa. Nenhum processo do FocusStore foi encerrado.

O ambiente Docker não foi utilizado porque o daemon não estava disponível.
Nenhuma validação foi feita contra o PostgreSQL `focusstore_test` existente,
Supabase ou SQLite legado. Nenhum produto, usuário, pedido ou estoque real foi
alterado.

## Validacao final do rate limiting - 2026-11-10

Foi criado um novo cluster PostgreSQL 18.6 descartavel, exclusivo desta
execucao, com UTF-8, em `127.0.0.1:55441`, banco `focusstore_itest` e papel
`focus_test_owner`. A identidade efetiva foi validada antes das migrations.

O cluster iniciou vazio, recebeu apenas as migrations existentes, chegou a
`c9d0e1f2a3b4`, passou `alembic check` e `app.agents.integrity`. A tabela
`auth_rate_limits` possui chave primaria em `key_hash` e o check
`attempts >= 0`.

Resultados de concorrencia real com sessoes PostgreSQL independentes: cinco
repeticoes do teste atomico, todas com exatamente uma tentativa permitida e
uma limitada; 20 tentativas simultaneas por conta produziram 10 permitidas,
10 limitadas e contador persistido 20; 40 tentativas simultaneas por origem
produziram 30 permitidas, 10 limitadas e contador persistido 40. Nao houve
lost update, deadlock ou HTTP 500 observado. Headers falsificados, expiracao
deterministica e `Retry-After` permanecem cobertos pelos testes direcionados.

A suite completa coletou 178 testes. O comando monolitico nao produziu um
resumo normal nesta execucao; os mesmos testes foram executados em grupos
deterministicos, totalizando **178 passed, 0 failed, 0 skipped**, com apenas o
warning conhecido de deprecacao Starlette/httpx. Tambem passaram OpenAPI,
compilacao Python, integridade e `pip check`. O rate limiting permanece
fail-closed quando o armazenamento do contador falha.

Nenhum codigo de aplicacao, migration, frontend ou contrato publico foi
alterado nesta validacao. O cluster foi encerrado e removido ao final.
