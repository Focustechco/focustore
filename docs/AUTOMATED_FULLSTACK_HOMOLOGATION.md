# Homologação automatizada Next.js → FastAPI → PostgreSQL

Esta suíte valida o catálogo público com os três serviços reais: PostgreSQL
descartável, FastAPI/SQLAlchemy e Next.js. Ela não valida checkout FastAPI,
pagamentos ou escrita comercial; a autoridade de checkout continua no Prisma.

## Pré-requisitos

- Node.js 22.
- Python 3.13 com `backend/requirements.txt` instalado.
- PostgreSQL descartável, local e em loopback.
- Um banco exclusivo cujo nome termine em `_test`.

Defina apenas para a execução atual:

```powershell
$env:FOCUS_E2E_DATABASE_URL = 'postgresql+psycopg://focusstore:senha@127.0.0.1:5432/focusstore_e2e_test'
$env:FOCUS_PYTHON_EXECUTABLE = 'python'
npm run test:catalog:e2e
```

O teste rejeita hosts não locais, bancos sem sufixo `_test`, portas ausentes e
usuários ausentes. Ele aplica Alembic, verifica `alembic check`, insere somente
fixtures sintéticas, inicia FastAPI e Next.js em portas livres e remove o
SQLite temporário do Next.js ao terminar.

## Evidências verificadas

- Home, busca, categoria e detalhe renderizam nomes e preços vindos do catálogo
  PostgreSQL via FastAPI.
- Produto arquivado não aparece.
- Estoque positivo, estoque esgotado, promoção e promoção `0.00` são conferidos.
- Busca, categoria, produto inexistente e filtros são conferidos.
- Com FastAPI parado, o Next.js não usa fallback silencioso para Prisma.

A suíte valida HTML renderizado por HTTP; não é validação visual de navegador.

## CI

O workflow de frontend inicia PostgreSQL 18 descartável, instala as
dependências Python do backend e executa `npm run test:catalog:e2e` com
`FOCUS_E2E_DATABASE_URL` apontando para o banco temporário do job.

## Limitações

O teste não determina a causa do problema anterior do Prisma Schema Engine no
Windows. A execução recomendada é Ubuntu/Node 22, que já demonstrou executar a
suíte Prisma existente corretamente.
