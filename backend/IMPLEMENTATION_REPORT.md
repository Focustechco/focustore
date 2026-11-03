# FocusStore — relatório de implementação da base backend

Data: 03/11/2026. Resultado: base ampliada e testada; **backend MVP completo ainda
não entregue**. Nenhum arquivo frontend foi modificado nesta etapa. Não houve
commit, push, deploy, seed, alteração de credenciais, migration ou escrita em
banco real. A integração de sessão e a proteção das escritas existentes foram
autorizadas expressamente pela usuária durante a execução.

## 1. Estado recebido e auditoria

Branch `main`, HEAD `6003759`. Já havia alterações locais da preparação Linux:
`.env.example`, `.gitignore`, `backend/.env.example`, `package.json`,
`src/lib/auth/social/persistence.ts`, `.nvmrc` e
`docs/LOCAL_DEVELOPMENT_LINUX.md`. Foram preservadas. A diferença em `src/` e
`package.json` que continua no Git pertence à etapa anterior; nenhum ajuste novo
foi feito nesses arquivos, em `prisma/` ou no frontend.

Backend existente: FastAPI, configuração Pydantic Settings, sessão SQLAlchemy,
models Category/Product, Alembic com head `e0dd9a760a45`, POST de categorias e
produtos, GET de produtos, /health, leitura de catálogo Prisma e agentes de
integridade/OpenAPI. Escritas SQLAlchemy estavam públicas. Categorias tinham
somente criação; produtos não tinham atualização/exclusão. Nenhum model de
usuário, carrinho ou pedido Python foi encontrado.

Frontend inspecionado somente para leitura: páginas de loja, busca, coleções,
produto/categoria, carrinho, checkout/confirmação, conta/pedidos/endereços,
favoritos e painel administrativo. Foram inspecionados tipos de carrinho,
CheckoutInput, serviços de catálogo/estoque/pedidos, sessão/requireAdmin,
endpoints Next e schema Prisma. Presença de UI/serviço não foi considerada prova
de funcionamento completo; o build do checkout recebido já tinha imports
removidos no histórico. Essa recuperação não pertence a esta implementação.

## 2. Matriz de contratos e responsabilidades

Estado nesta tabela significa código inspecionado e implementação deste ciclo;
não significa integração automática nem validação ponta a ponta no frontend.

| Funcionalidade frontend | Dados / campos relevantes | Endpoint existente ou proposto | Responsável / estado | Regras e pendências |
| --- | --- | --- | --- | --- |
| Vitrine e busca | produto string ID, slug, sku, preços, imagens, variantes, categoria | Next CatalogService direto ao Prisma; FastAPI GET /api/v1/catalog/products | Prisma dono; leitor FastAPI reaproveitado | ACTIVE; política de produto oculto ainda diverge; busca/preços/sort Next mais ricos |
| Produto individual | slug, galeria, variantes color/size/model e estoque | GET /api/v1/catalog/products/{slug} | leitor existente | 404 sem ativo; IDs originais preservados |
| Categorias/coleções | slug, parentId, description, posição, imagens; relação N:N | Next CatalogService; GET /api/v1/catalog/categories | leitor categorias existente; coleções permanecem Next | não confundir IDs/string e relação N:N com modelo SQLAlchemy |
| Cadastro admin de produtos | name/slug/sku/basePrice/status, images, variants, categoryIds, collectionIds, SEO/dimensões | Next /api/admin/products e /{id}; FastAPI /products é catálogo simples separado | fluxo Next mantido; CRUD SQLAlchemy completado | não substituível diretamente; autorização Python ADMIN/MANAGER |
| Categorias admin | name/slug/description/imageUrl/iconName/position/isActive | Next /api/admin/categories e /{id}; FastAPI /categories | CRUD Python simples completado | slug único; categoria com produto não pode ser excluída |
| Login e sessão | e-mail/CPF, senha bcrypt; focus_session; role | Next /api/auth/login, register, session e social/{provider}/start,callback; novo GET /api/v1/users/me | Next único autenticador; ponte Python de leitura implementada | sessão válida e papel atual, sem novo login/usuário/token |
| Conta/endereços/clientes | identificação, telefone, CPF, endereços e papel | páginas Next e /api/admin/customers e /{id} | leitura do próprio perfil Python implementada; CRUD sensível permanece Next | não aceitar identidade de body/header; sem novo cadastro duplicado |
| Carrinho | CartItem com variantId/productId/name/price/promotionalPrice/quantity | localStorage focus_cart; novo POST /api/v1/cart/quote | edição local mantida; cotação Python implementada | servidor aceita só IDs/quantidades; agrupa repetidos e verifica saldo |
| Checkout | customer, shippingAddress, items, shippingOption, couponCode, paymentMethod, idempotencyKey | Next POST /api/checkout e validate-coupon | gravação existente preservada; transferência para Python bloqueada | fonte de verdade/transação de pedido+estoque precisa ser definida |
| Pedidos da conta/confirmação | número, status, preços da compra, itens, pagamentos, entregas | Next OrderService; novos GET /api/v1/orders e /{id} | leitura Python dos próprios pedidos implementada | filtro de dono no SQL; estrangeiro/visitante recebe 404 |
| Estoque | quantityAvailable/quantityReserved por variante; stock inteiro legado | Next /api/admin/inventory e /{id}; nova disponibilidade e /products/{id}/stock-adjustments | Prisma escreve variantes; Python ajusta apenas stock SQLAlchemy | ajuste SQL condicional; não é reserva Prisma nem sincronização |
| Frete/cupom/pagamento | CEP, subtotal, serviço, desconto, método | Next /api/shipping/calculate, /api/checkout/validate-coupon, /api/payments/webhook | existentes mantidos, não certificados ponta a ponta | sem provedor real implementado neste ciclo |
| Banners, upload, favoritos e auditoria | imagem/posição; favoritos; eventos | Next /api/admin/banners, upload e contextos/serviços próprios | fora do novo backend, sem duplicação | integração posterior; segurança frontend não foi alterada |

## 3. Arquitetura e fonte de verdade

Mantida a estrutura atual: `api/routes` adapta HTTP; `schemas` valida contratos;
`services` contém regras; `models/db` mantém SQLAlchemy; `integrations` acessa
fontes externas ao domínio SQLAlchemy; `security` resolve sessão e autorização.
Sem framework adicional, repositório genérico complexo ou dependência nova.

Decisão conservadora para este ciclo:

1. Prisma/SQLite continua fonte autoritativa de usuários/sessões, catálogo de
   vitrine, variantes/estoque, carrinhos/tabelas existentes e pedidos. Python
   acessa essa fonte **somente para leitura** (`mode=ro`, `query_only`, transação
   de leitura). Nem arquivos ausentes são criados silenciosamente.
2. SQLAlchemy mantém o domínio simples de categorias/produtos/stock que já
   existia, em banco backend separado. Seus IDs inteiros não são IDs Prisma.
   O CRUD entregue não passa a ser dono do catálogo da loja automaticamente.
3. Nenhuma nova tabela ORM, migration, auth independente ou escrita dupla foi
   criada. Novos modelos Pydantic são contratos, não novas tabelas de usuários,
   carrinho ou pedidos.
4. O leitor comum `prisma_sqlite.py` foi extraído do adaptador existente e é
   reutilizado por catálogo, sessão, cotação e pedidos. A fixture sintética de
   catálogo foi centralizada em conftest para os testes relacionados.
5. PostgreSQL é o destino configurado/planejado para o banco Python, mas não há
   instância de desenvolvimento disponível. Schema Prisma SQLite e migrations
   Prisma PostgreSQL seguem divergentes no checkout recebido. Essa situação
   não foi mascarada com outra base ou alteração do frontend.

## 4. Funcionalidades entregues

### Produtos/categorias existentes

- Reaproveitados models, tabelas, IDs e migrations.
- CRUD completo do domínio simples, mantendo GET/POST existentes.
- Paginação limitada, filtro de categoria e busca literal por nome em produtos.
- PATCH parcial com validação de campos obrigatórios, precisão monetária,
  inteiros estritos, espaços, nulos e campos extras.
- Existência da categoria, conflitos de slug, prevenção de exclusão de categoria
  vinculada e rollback seguro em conflito.
- Serviços de domínio com erros HTTP adaptados centralmente e erros de banco
  sanitizados. Parâmetros SQLAlchemy ocultos em mensagens do engine.
- Escritas existentes e novas exigem sessão real, ADMIN/MANAGER e origem válida.
  Foi uma mudança de segurança autorizada, não remoção de endpoints.

### Identificação/autorização

- GET /api/v1/users/me, sem senha/hash/token no retorno.
- Cookie já existente focus_session, checagem de expiração e papel atual.
- Sem criar ou modificar credenciais, usuários, contas OAuth ou sessões.
- 401 para sessão inválida, 403 para papel/origem indevidos, 503 sem fonte.
- OpenAPI declara autenticação APIKeyCookie e os erros das escritas.
- CORS credenciado opt-in com origem exata; controles de origem nas escritas.

### Carrinho e disponibilidade

- Cotação stateless: preços por variante no servidor, Decimal e centavos,
  quantidade limitada e soma de variantes repetidas antes do teste de estoque.
- Rejeita IDs desconhecidos/inativos, inventário ausente, saldo insuficiente e
  tentativa de enviar preços/identidade como entrada da cotação.
- Disponibilidade por variante usa quantity_available já líquido de reservas.
- Não cria carrinho persistente, pedido, reserva ou pagamento. Adicionar/remover/
  atualizar itens continua na lista do frontend, que pode ser recotada.

### Pedidos

- Listagem paginada e detalhe dos pedidos existentes do usuário autenticado.
- Filtro de dono no SQL e 404 uniforme para outro dono, guest ou inexistente.
- Retorna snapshots financeiros dos itens e estado atual do pedido, sem gravar
  ou recalcular histórico pelo preço atual do catálogo.
- Dados privados sem cache; sem pagamentos, endereços e tokens no novo DTO.
- Não foram criados POST de pedido, mudança de status ou acesso de visitante.

### Estoque SQLAlchemy

- Novo ajuste por delta com UPDATE atômico condicionado a saldo final válido.
- Evita estoque negativo e overflow intermediário via BIGINT; retorna 409 no
  ajuste impossível. Teste com duas retiradas concorrentes da última unidade.
- PATCH usa bloqueio de linha quando suportado pelo PostgreSQL.
- Sem nova tabela de movimento/auditoria e sem efeito no inventário Prisma.
  Não é uma implementação de reserva de checkout.

## 5. Contratos e integração

Consulte [API_INTEGRATION.md](docs/API_INTEGRATION.md) para a tabela das 20
operações, corpos, respostas, validações, autenticação, exemplos fetch e
incompatibilidades. Consulte [openapi.json](docs/openapi.json) para o contrato
máquina, também servido em /openapi.json.

A referência OpenAPI foi atualizada intencionalmente após revisar diferenças:
novos caminhos/métodos/DTOs, segurança por cookie, respostas de erro e validações
mais estritas. Não foram excluídos endpoints ou alterados testes para aceitar um
snapshot diferente sem regeneração real. O agente de comparação passou depois
da atualização. Os testes existentes de escrita agora usam `admin_client`, que
resolve uma sessão de formato real numa base sintética; não substitui a função
de autorização por um mock permissivo. Casos sem cookie continuam explícitos.

Configuração nova opcional: `FRONTEND_ORIGIN`, descrita no exemplo backend.
`LEGACY_CATALOG_SQLITE_PATH` existente passa a servir também identidade/pedidos.
Nenhum .env real foi criado/sobrescrito nesta etapa; a configuração deve ser
feita pela usuária em arquivo local seguro. Sem fonte configurada, o acesso
protegido falha fechado.

## 6. Verificações e resultados

Ambiente reaproveitado: Python 3.12.3 e `backend/.venv`, dependências existentes.
Nenhuma instalação ou atualização de dependência foi necessária neste ciclo.

| Verificação executada | Resultado / limites |
| --- | --- |
| Lote CRUD/autorização inicial | 29 testes aprovados |
| Lote cotação/identidade/pedidos/catálogo | 44 testes aprovados |
| Lote autorização/CORS/estoque | 33 testes aprovados na etapa intermediária |
| Suíte final completa | **112 aprovados, 5 pulados, 1 aviso** em 3,56 s |
| Agente OpenAPI | PASS; snapshot coincide com geração nativa |
| Rotas/OpenAPI | 14 caminhos, 20 operações; segurança cookie verificada |
| Compileall/importações e pip check | aprovados; sem dependências quebradas |
| Alembic heads | head único e0dd9a760a45 |
| Alembic PostgreSQL offline | SQL gerado sem conexão/aplicação; arquivo de revisão em /tmp |
| Migrations SQLite nos testes existentes | upgrade/check/downgrade somente em arquivos temporários |
| Uvicorn + HTTP real | /health 200; /openapi.json 200; /users/me e /orders 401 sem sessão; POST /categories 401 |
| PostgreSQL real | NÃO TESTADO: instância/credenciais indisponíveis |
| Sessão real da usuária / login browser integrado | NÃO TESTADO: nenhum login/usuário real foi usado |
| Build/testes frontend | NÃO EXECUTADOS neste ciclo; frontend é somente leitura |

Os lotes se sobrepõem: não somar suas contagens à suíte final. Os cinco pulados
são os testes de integridade PostgreSQL existentes, que requerem
TEST_DATABASE_URL de banco local descartável terminado em _test. O aviso é a
depreciação httpx/Starlette TestClient; nenhuma dependência foi trocada para
ocultá-lo. Testes foram executados fora do sandbox para permitir os sockets do
TestClient. Em todos eles, bases SQLAlchemy, catálogo, identidades e pedidos são
sintéticos e temporários. Testes de leitura comparam bytes antes/depois.

Comando reproduzível a partir de backend:

```bash
DATABASE_URL=sqlite:///:memory: .venv/bin/python -m pytest -q -ra
DATABASE_URL=sqlite:///:memory: .venv/bin/python -m app.agents.openapi_check
.venv/bin/python -m pip check
```

A URL em memória acima é bootstrap para testes; fixtures fornecem a persistência
isolada. Não é configuração de desenvolvimento PostgreSQL nem produção.
Para iniciar desenvolvimento real, configure backend/.env com o banco backend
separado e autorizado e os campos de integração; depois:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Não executar migrations no banco escolhido sem revisão/aprovação e backup.
O /health confirma o processo, não a disponibilidade da persistência.

## 7. Arquivos desta implementação

Modificados:

- `backend/.env.example`: documenta origem e fonte compartilhada de leitura;
  preserva o exemplo e alterações locais anteriores.
- `backend/app/config.py`: valida a configuração opcional de origem.
- `backend/app/main.py`: factory, CORS, erros seguros, cabeçalhos privados.
- `backend/app/api/router.py`: registro dos novos módulos.
- `backend/app/api/routes/categories.py`, `products.py`: CRUD e autorização.
- `backend/app/schemas/category.py`, `product.py`: validações e PATCH/ajuste.
- `backend/app/db/session.py`: ocultação de parâmetros em erros do engine.
- `backend/app/integrations/legacy_catalog/repository.py`: reutiliza conexão de
  leitura comum; comportamento público do catálogo existente preservado.
- `backend/docs/openapi.json`: contrato gerado e revisado.
- `backend/tests/conftest.py`: fixtures reais em bases sintéticas, FK SQLite
  ativa, catálogo compartilhado e sessão administrativa de teste.
- `backend/tests/test_categories.py`, `test_products.py`: usam autenticação
  exigida pelo contrato autorizado; mantidas as asserções de negócio.
- `backend/tests/test_catalog.py`: fixture movida para conftest, asserções mantidas.

Criados:

- `backend/app/integrations/prisma_sqlite.py`.
- `backend/app/security/__init__.py`, `session.py`.
- `backend/app/api/routes/cart.py`, `identity.py`, `orders.py`.
- `backend/app/schemas/cart.py`, `identity.py`, `orders.py`.
- `backend/app/services/management.py`, `cart.py`, `orders.py`.
- `backend/tests/test_management.py`, `test_cart_quote.py`,
  `test_identity_orders.py`, `test_security_config.py`.
- `backend/docs/API_INTEGRATION.md` e este relatório.

Não foram alterados models ORM, requirements, migrations, frontend, seed.ts,
settings.json, package.json, arquivos .env, bancos ou backups nesta etapa.
Artefatos Python/pytest temporários permanecem ignorados conforme regras locais.

## 8. Bloqueios e próximas tarefas

1. **CONFIGURAÇÃO PENDENTE:** instalar/configurar PostgreSQL backend local,
   fornecer credenciais só em arquivo seguro e aprovar migrations no destino
   correto. Executar testes reais de integridade, concorrência e rollback PG.
2. **DECISÃO PENDENTE:** definir fonte final do catálogo/estoque e domínio de
   escrita dos pedidos. Escolher transição Prisma versus SQLAlchemy com IDs,
   variantes, preços, ownership, backup e migração aprovados. Nenhuma segunda
   tabela de usuários/pedidos foi criada como atalho.
3. **NÃO IMPLEMENTADO no FastAPI:** carrinho persistente, criação de pedido,
   cancelamento/transição de estados, reserva/liberação de estoque de compra,
   idempotência persistente e trilha de movimentos/auditoria. Há implementação
   Next relacionada, que deve ser consolidada e auditada antes de transferir.
4. **INTEGRAÇÃO PENDENTE:** equipe frontend adotar as rotas novas explicitamente,
   configurar CORS/cookie no mesmo ambiente e adaptar camelCase/snake_case,
   Decimal, envelopes e PATCH. Não conectar o CRUD simples à vitrine como se
   fossem as mesmas tabelas.
5. **REVISÃO PENDENTE:** alinhar promoções zero, filtro de produtos ocultos,
   permissões do checkout/identidade enviada pelo cliente e concorrência do
   inventário Next. A proteção das APIs Python não altera a segurança Next.
6. **CONFIGURAÇÃO PENDENTE:** implantação futura da ponte de sessão entre
   serviços, OAuth real e decisão de pagamentos/provedor. Não houve pagamento
   real nem deploy.
7. **BLOQUEIO ANTERIOR:** imports frontend removidos e migração Prisma divergente
   seguem preservados para outra tarefa; não foram recriados nesta entrega.

Conclusão: CRUD simples, autorização integrada e consultas/cotação estão
funcionais nos testes isolados. O MVP de compra persistente completo não deve
ser declarado pronto enquanto os itens acima não forem resolvidos e testados.


## Auditoria posterior antes dos commits — 03/11/2026

O resultado original acima (112 aprovados/5 pulados) foi reproduzido. A revisão
acrescentou dois testes de regressão para metadados nulos no catálogo da cotação
e corrigiu o escape de ValidationError para responder 503 sanitizado.
Resultado final desta revisão: **114 aprovados, 0 falhos e 5 pulados**. OpenAPI,
importações, pip check e Uvicorn /health passaram. PostgreSQL real e integração
com sessão real ainda não foram validados; conclusão da auditoria:
**CORREÇÕES NECESSÁRIAS**. Detalhes e seleção exata dos commits estão em
[PRE_COMMIT_AUDIT.md](docs/PRE_COMMIT_AUDIT.md). Nenhum commit foi executado.
