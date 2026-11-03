# FocusStore — auditoria final antes dos commits

Data: 03/11/2026. **Resultado: CORREÇÕES NECESSÁRIAS.**
A suíte local não tem falhas, mas a validação PostgreSQL essencial à persistência
e concorrência segue indisponível. Esta auditoria não autoriza commit, push,
deploy, importação ou migration em bancos existentes.

## Testes e execução

| Verificação | Resultado |
| --- | --- |
| Suíte recebida, antes das correções | 112 aprovados, 0 falhos, 5 pulados; igual ao relatório anterior |
| Regressões novas, antes da correção | 2 falhas reproduzidas: metadados nulos na origem escapavam como exceção de validação |
| Suíte completa final | **114 aprovados, 0 falhos, 5 pulados**, em 3,38 s |
| Aviso final | 1 depreciação httpx/Starlette TestClient, já existente |
| OpenAPI gerado versus snapshot | PASS; 14 caminhos, 20 operações; snapshot não precisou ser alterado |
| Contratos | ProductResponse, CategoryResponse, CartQuote, OrderPage e CurrentUser conferidos no OpenAPI |
| Bibliotecas/AST | FastAPI, Uvicorn, SQLAlchemy, Psycopg, Pydantic, Alembic importados; sintaxe de app/ conferida |
| pip check | sem dependências quebradas; nenhuma dependência instalada/alterada nesta auditoria |
| Uvicorn real isolado | /health 200 com corpo esperado; /openapi.json 200; perfil e pedidos sem cookie 401 |
| git diff --check | sem erros |
| PostgreSQL/Supabase real | NÃO TESTADO: não há PostgreSQL de teste/TEST_DATABASE_URL configurado |
| Integração browser Next + sessão real | NÃO TESTADA; testes de sessão usam base sintética de formato real |

Os cinco pulados são os casos PostgreSQL de test_integrity_agent.py: schema
saudável, casos de integridade e comportamento do agente contra o dialeto real.
Não se tornaram aprovados por terem sido pulados. Também falta uma matriz de
CRUD/transações/concorrência dos módulos novos no PostgreSQL: SQLite não valida
bloqueios FOR UPDATE, limites/tipos e falhas de concorrência PostgreSQL.

A suíte foi executada com bootstrap `DATABASE_URL=sqlite:///:memory:`. Fixtures
usam arquivos temporários independentes, inclusive para o teste existente de
migrations, que aplica e desfaz revisões somente no arquivo temporário. Nenhuma
migration foi executada manualmente nesta auditoria; nenhum banco real foi
modificado. O processo HTTP real usou configuração isolada em memória e foi
encerrado depois das verificações.

Comando de suíte, a partir de backend:

```bash
DATABASE_URL=sqlite:///:memory: .venv/bin/python -m pytest -q -ra
```

## Problemas encontrados e corrigidos

1. **Corrigido:** CartService validava nome/SKU de origem fora do tratamento de
   erro do catálogo. Dois casos sintéticos com coluna nula reproduziram a
   exceção. Agora ValidationError na montagem do item vira CatalogUnavailable,
   retornando 503 com mensagem genérica. Foram acrescentados dois casos
   parametrizados, mantendo as asserções existentes. Não houve mudança no
   contrato de sucesso nem atualização artificial do snapshot.
2. **Corrigido:** o plano ainda recomendava Neon. Agora Supabase PostgreSQL é a
   decisão atual; Neon aparece apenas como comparação histórica. Atualizados
   resumo, recomendação, autenticação, referência de hospedagem e backlog.
   Preservados os planos de dados, sessões, corte e rollback. Registrado que
   schema privado store não deve ser exposto pela Data API Supabase.
3. **Identificado, não removido:** bancos locais e .pyc já rastreados antes das
   entregas. Não fazem parte dos diffs propostos, mas continuam na árvore e no
   histórico Git. .gitignore não os retira do versionamento. Não houve exclusão
   nem git rm --cached.
4. **Identificado:** backend/.env.example tem conteúdo misto: comentário de
   caminho Linux veio da preparação anterior; comentários de CORS/fonte
   compartilhada pertencem ao backend. Deve receber seleção parcial no commit.

## Revisão técnica e limites

- Sessão: cookie existente, expiração UTC/milissegundos/ISO, papel atual,
  revogação e fonte ilegível foram revisados/testados. Não há novo autenticador
  ou identidade padrão em runtime; sessão antiga inválida não ganha fallback.
- ADMIN/MANAGER: todas as escritas de categorias, produtos e ajuste de stock
  usam a dependência administrativa; CUSTOMER recebe 403, anônimo 401.
  Origin inválida/ausente e Fetch Metadata cross-site são rejeitados. CORS só
  habilita origem exata; testes de origem confiável e hostil passaram.
- O controle de origem atual não implementa o novo token CSRF proposto no plano;
  isso permanece trabalho futuro, sem declaração de arquitetura final pronta.
- CRUD: preservadas rotas existentes e adicionados PATCH/DELETE/listagem de
  categorias. Restrição de categoria vinculada, unicidade de slug e rollback
  em conflitos foram testados. Escritas agora requerem sessão por autorização
  expressa da usuária na etapa de implementação; é mudança deliberada de acesso.
- Preços: Decimal positivo e precisão declarada no CRUD; cotação usa preço da
  fonte, inclui promoção zero e rejeita preços enviados no body. Quantidades
  estritas, duplicatas somadas e saldo conferido antes da resposta.
- Estoque SQLAlchemy: UPDATE condicionado a saldo válido e expressão BIGINT;
  concorrência de duas retiradas foi ensaiada no SQLite. Não é uma prova de
  concorrência PostgreSQL nem uma reserva de compra Prisma.
- Pedidos: filtro de dono no SQL; pedido alheio/guest/inexistente recebe 404;
  dinheiro vem do snapshot. Perfil/pedidos usam no-store. Não existe novo POST
  de pedido, cancelamento, transição de estado ou compra persistente FastAPI.
- Transações: commit/rollback dos conflitos e FKs foram revisados/testados no
  domínio SQLAlchemy. Fechamento de Session permite rollback em erros não
  confirmados. Ordem+estoque do checkout atual continua no Next/Prisma, sem
  duplicação Python. Não foi certificado o checkout completo.
- Erros: SQLAlchemy, fonte de sessão, pedidos e catálogo têm mensagens genéricas;
  o caso novo de metadados inválidos foi corrigido com teste de regressão.
- Dependências/models/migrations: sem mudança em requirements, models ORM ou
  revisões Alembic nesta entrega; compatibilidade SQLite do histórico passou
  pelo teste existente. Não foi feita aplicação de revisões PostgreSQL.
- Frontend: nenhum arquivo src/, prisma/, package.json ou config frontend foi
  alterado nesta auditoria. A API simples com IDs inteiros não é substituta
  direta do catálogo Prisma com IDs string, variantes e relações N:N. Adaptação
  de camelCase/envelopes e Decimal está documentada. Existem imports removidos
  no frontend e divergência SQLite versus migrations Prisma PG desde antes
  destas entregas; não foram corrigidos para forçar uma aprovação.

## Git, segredos e arquivos locais

Branch main, referência local origin/main; índice inicialmente vazio. Não foram
executados git add, commit, push, pull, merge, reset ou limpeza de arquivos.
Inspecionados arquivos alterados/não rastreados, diffs e conteúdo dos candidatos
backend. Busca por chaves privadas, tokens conhecidos e URLs com credenciais
não encontrou segredo real nos candidatos. Valores de credencial não foram
impressos. Strings sintéticas dos testes e placeholders não são credenciais de
produção. Arquivos de ambiente reais não foram exibidos nem modificados.

Confirmação de ignore: .env, .env.local, backend/.env, .venv, node_modules,
.local-tools e novos SQLite locais estão ignorados na árvore atual. O exemplo
backend/.env.example é intencionalmente versionável e contém placeholders e
comentários; não é arquivo de credenciais.

Já rastreados no HEAD anterior, **não incluir como novas alterações**:

- prisma/dev.db e prisma/dev.backup.db.
- backend/app/__pycache__/__init__.cpython-313.pyc.
- backend/app/__pycache__/__init__.cpython-314.pyc.
- backend/app/__pycache__/main.cpython-313.pyc.
- backend/app/__pycache__/main.cpython-314.pyc.
- backend/tests/__pycache__/test_health.cpython-313-pytest-9.1.1.pyc.

A inclusão seletiva dos commits não remove esses arquivos herdados da árvore
Git. Se a exigência for eliminar bancos/binários de todo versionamento,
planejar mudança separada de rastreamento/histórico com autorização e preservação
local; nunca fazer isso implicitamente nesta auditoria.

## Separação dos dois commits — ainda não executados

### Commit 1

`feat(backend): implement core ecommerce APIs and authorization`

Os arquivos abaixo pertencem à implementação e à sua revisão final. Para
backend/.env.example, incluir **somente** os comentários novos FRONTEND_ORIGIN e
fonte compartilhada. A troca de exemplo C:/... por /absolute/... é anterior e
pode ficar de fora por seleção parcial do diff. Não adicionar o arquivo inteiro
sem revisar essa mistura de escopos. Nenhum comando de staging foi executado.

- `backend/.env.example` — seleção parcial descrita acima.
- `backend/IMPLEMENTATION_REPORT.md`
- `backend/app/api/router.py`
- `backend/app/api/routes/cart.py`
- `backend/app/api/routes/categories.py`
- `backend/app/api/routes/identity.py`
- `backend/app/api/routes/orders.py`
- `backend/app/api/routes/products.py`
- `backend/app/config.py`
- `backend/app/db/session.py`
- `backend/app/integrations/legacy_catalog/repository.py`
- `backend/app/integrations/prisma_sqlite.py`
- `backend/app/main.py`
- `backend/app/schemas/cart.py`
- `backend/app/schemas/category.py`
- `backend/app/schemas/identity.py`
- `backend/app/schemas/orders.py`
- `backend/app/schemas/product.py`
- `backend/app/security/__init__.py`
- `backend/app/security/session.py`
- `backend/app/services/cart.py`
- `backend/app/services/management.py`
- `backend/app/services/orders.py`
- `backend/docs/API_INTEGRATION.md`
- `backend/docs/PRE_COMMIT_AUDIT.md`
- `backend/docs/openapi.json`
- `backend/tests/conftest.py`
- `backend/tests/test_cart_quote.py`
- `backend/tests/test_catalog.py`
- `backend/tests/test_categories.py`
- `backend/tests/test_identity_orders.py`
- `backend/tests/test_management.py`
- `backend/tests/test_products.py`
- `backend/tests/test_security_config.py`

### Commit 2

`docs(architecture): plan migration to Supabase PostgreSQL`

- `backend/docs/ARCHITECTURE_MIGRATION_PLAN.md`.

Este commit depende conceitualmente do contrato/backend do commit 1 e deve vir
depois dele. O documento não executa migração nem aprova deploy.

### Alterações anteriores fora dos dois commits

- `.env.example`.
- `.gitignore`.
- `.nvmrc`.
- `docs/LOCAL_DEVELOPMENT_LINUX.md`.
- `package.json`.
- `src/lib/auth/social/persistence.ts`.

Também deixar de fora a alteração anterior de caminho em backend/.env.example,
ambientes locais, arquivos .env reais, .venv, node_modules, .local-tools, bancos,
backups e caches. Não usar git add . nem git add backend/ indiscriminadamente.
Antes de qualquer commit autorizado, revisar o diff staged e a lista exata de
arquivos; esta auditoria deixou o índice vazio.

## Pendências para liberação

1. Disponibilizar PostgreSQL de teste local/isolado, sem credenciais de empresa
   ou produção. Executar os cinco testes pulados e os cenários dos módulos novos
   contra PostgreSQL, incluindo concorrência e rollback; registrar evidências.
2. Validar a integração Next/sessão real em homologação isolada. Os testes
   sintéticos e contratos confirmados não equivalem ao navegador integrado.
3. Manter a seleção dos dois commits livre da preparação local anterior; decidir
   separadamente o tratamento dos bancos/.pyc já rastreados.

A alteração de cotação está corrigida e a suíte disponível passou. Ainda assim,
o resultado global solicitado permanece **CORREÇÕES NECESSÁRIAS**, sem falha
atual de teste, por falta da validação essencial PostgreSQL e da integração real.
Não confundir prontidão dos arquivos de documentação com aprovação do backend
completo ou de produção. Nada foi commitado ou enviado ao remoto.
