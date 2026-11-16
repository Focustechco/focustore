# Homologação full-stack local

Este roteiro valida a leitura do catálogo em um PostgreSQL descartável. Ele
não executa deploy, checkout FastAPI, pagamentos, cutover ou migrations em
bancos persistentes.

## Ambiente validado

- Windows;
- Python 3.13.16;
- PostgreSQL 18.6;
- Node.js 22.14.0, baixado para diretório temporário apenas para os testes;
- FastAPI em `127.0.0.1:18002`;
- Next.js planejado em `127.0.0.1:18003`;
- PostgreSQL descartável em `127.0.0.1:55453`;
- banco `focusstore_homolog_test`;
- usuário sintético `homolog_test`.

## PostgreSQL descartável

```powershell
$pg = 'C:\Program Files\PostgreSQL\18\bin'
$data = 'C:\caminho\temporario\homolog-pg-<timestamp>'
& "$pg\initdb.exe" -D $data -U homolog_test -A trust --no-locale --encoding=UTF8
& "$pg\pg_ctl.exe" -D $data -o '-p 55453' -l "$data\server.log" -w start
& "$pg\psql.exe" -h 127.0.0.1 -p 55453 -U homolog_test -d postgres -c 'CREATE DATABASE focusstore_homolog_test;'
```

Antes das migrations, confirme que host, porta, banco e usuário apontam para
essa instância. Nunca use o `.env` real:

```powershell
$env:DATABASE_URL = 'postgresql+psycopg://homolog_test@127.0.0.1:55453/focusstore_homolog_test'
$env:CATALOG_SOURCE = 'postgresql'
$env:PYTHONPATH = (Get-Location).Path + '\backend'
alembic -c backend\alembic.ini upgrade head
alembic -c backend\alembic.ini check
python -m app.agents.integrity
```

Carregue somente dados sintéticos. A seed de homologação usada nesta revisão
continha produtos ativos, produto inativo, três categorias, variantes,
imagens, produto sem imagem, estoque disponível, estoque zero e promoção
`0.00`.

## FastAPI

Use uma configuração explícita e fail-closed:

```powershell
$env:DATABASE_URL = 'postgresql+psycopg://homolog_test@127.0.0.1:55453/focusstore_homolog_test'
$env:CATALOG_SOURCE = 'postgresql'
$env:FOCUS_DEBUG = 'false'
$env:FASTAPI_CHECKOUT_ENABLED = 'false'
$env:CHECKOUT_WRITE_AUTHORITY = 'prisma'
$env:MIGRATION_MODE = 'observe'
$env:FASTAPI_PAYMENT_SIMULATOR_ENABLED = 'false'
python -m uvicorn app.main:app --host 127.0.0.1 --port 18002
```

Valide health, OpenAPI, listagem, categorias, filtros, busca, paginação,
ordenação e detalhe do produto:

```powershell
Invoke-RestMethod http://127.0.0.1:18002/health
Invoke-RestMethod 'http://127.0.0.1:18002/api/v1/catalog/products?limit=10&sort=price_asc'
Invoke-RestMethod 'http://127.0.0.1:18002/api/v1/catalog/categories?limit=10'
```

## Next.js

O frontend deve usar uma base SQLite separada, sem dados persistentes:

```powershell
$env:DATABASE_URL = 'file:C:/tmp/focusstore-homolog/frontend.db'
$env:CATALOG_READ_SOURCE = 'fastapi'
$env:FOCUS_API_BASE_URL = 'http://127.0.0.1:18002'
$env:NEXTAUTH_SECRET = 'homolog-only-secret'
$env:NEXT_TELEMETRY_DISABLED = '1'
node node_modules\next\dist\bin\next dev --hostname 127.0.0.1 --port 18003
```

Verifique `/`, `/busca?q=...`, `/categoria/<slug>` e `/produto/<slug>`.
Produtos FastAPI são somente leitura e não devem ser adicionados ao checkout
Prisma. Falhas HTTP, timeout e rede devem mostrar indisponibilidade, não zero
produtos; uma resposta válida vazia deve continuar mostrando zero.

## Testes

```powershell
node node_modules\typescript\bin\tsc --noEmit
node node_modules\tsx\dist\cli.mjs --test --test-concurrency=1 tests\catalog-api.test.ts tests\catalog-load-state.test.ts
pytest backend\tests -q
python -m pip check
```

Na revisão de 2026-11-16, os testes de contrato e estado passaram **11/11**,
TypeScript passou, o backend passou **206 testes**, Alembic/integridade/pip
check passaram e os endpoints FastAPI responderam com a seed sintética.

## Limitação observada

O `prisma db push` do SQLite temporário falhou com `Schema engine error` nesta
instalação Windows, embora o schema valide. O Next.js compilou e executou o
TypeScript no build, mas Next 16.4.1 interrompeu build/dev por uma recomendação
de atualização de segurança. Por isso, esta execução demonstra
PostgreSQL → FastAPI → JSON e os contratos TypeScript, mas não deve afirmar
que a interface Next.js foi visualizada com dados PostgreSQL.

O upgrade de segurança deve ser tratado separadamente, após revisão da versão
alvo e da CI; não foi aplicado nesta homologação.

## Encerramento

```powershell
& "$pg\pg_ctl.exe" -D $data -m fast -w stop
```

Confirme que FastAPI, Next.js e PostgreSQL foram encerrados. Os arquivos de
log temporários não contêm credenciais reais.
