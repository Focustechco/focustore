# Integração incremental do catálogo

## Diagnóstico e contrato antes de mudanças de tabelas

O Next.js usa `src/lib/db/prisma.ts` e `CatalogService` diretamente, sem
consultar FastAPI. O Prisma usa SQLite; FastAPI usa SQLAlchemy/PostgreSQL.
As tabelas homônimas não são compartilhadas. Nenhuma mudança de tabela ou
importação de dados é necessária para a adaptação de leitura.

| Conceito | Prisma / SQLite | Python / PostgreSQL atual | Contrato de leitura |
| --- | --- | --- | --- |
| Produto ID | String, UUID por padrão, chave primária | Integer, chave primária | String original, namespace separado |
| Nome | String obrigatória | VARCHAR(150) obrigatório | name |
| Descrição | String obrigatória, shortDescription opcional | Text opcional | description, short_description |
| Preço | basePrice Float obrigatório | price Numeric(10,2), > 0 | base_price Decimal |
| Promoção | promotionalPrice Float opcional | ausente | promotional_price Decimal ou null |
| SKU / slug | String obrigatória, únicos | ausentes | preservados |
| Status / marca | String, defaults ACTIVE / Focus | ausentes | status / brand; somente ACTIVE público |
| Estoque | Inventory opcional por variante; inteiros disponível/reservado | stock inteiro >= 0 no produto | separado por variante, sem soma |
| Imagens | ProductImage[], URL obrigatória, altText opcional, posição e principal | ausentes | referências preservadas e ordenadas |
| Categorias | relação N:N ProductCategory, chave composta | category_id inteiro obrigatório, FK | IDs String; categorias ativas |
| Variantes | ID String, SKU único, preço Float, atributos opcionais | ausentes | variantes ativas com estoque individual |

Category Prisma tem slug único, parentId, description e imageUrl opcionais,
position inteiro (default 0), isActive (default true). Category Python tem
name VARCHAR(120), slug VARCHAR(140), ambos obrigatórios, slug único.
ProductVariant tem name/price obrigatórios, position default 0, isActive
default true e color/colorHex/size/model/imageUrl/promotionalPrice opcionais.
Inventory tem variant_id único, quantity_available/quantity_reserved default 0.
Esses tipos/defaults do Prisma não equivalem às CHECK constraints do PostgreSQL.

Fontes conferidas: `prisma/schema.prisma`, `src/lib/db/prisma.ts`,
`src/modules/catalog/catalog.service.ts`, `src/modules/inventory/inventory.service.ts`,
rotas administrativas de produtos/upload, página de cadastro e página por slug;
`backend/app/models/{product,category}.py` e rotas Python existentes.

## Estratégia e fonte de verdade

O catálogo da loja continua pertencendo ao sistema Prisma. O PostgreSQL é
a fonte dos endpoints Python `/products` e `/categories` existentes.
Cadastrar em `POST /products` não publica no Next.js. Não há sincronização,
conversão de UUID em inteiro, migração ou união automática desses registros.
Futura consolidação precisará de um mapeamento persistente explícito
`(origem, id externo) -> id destino`, com unicidade, antes de importar.

Implementado: leitura opcional via SQLite independente em modo `ro`, com
`query_only`, transação por consulta e sem cache de resultados. Novos registros
confirmados pelo painel aparecem nas consultas posteriores. API, serviço,
repositório e mapeamento estão separados; não há operações de escrita nesse
adaptador. Consultas usam parâmetros e selecionam apenas dados do catálogo.

Endpoints novos:

- `GET /api/v1/catalog/products?offset=0&limit=20`
- `GET /api/v1/catalog/products/{slug}`
- `GET /api/v1/catalog/categories?offset=0&limit=20`

Listagens retornam items/total/offset/limit; limit entre 1 e 100.
Ordenação estável por slug/id para produtos e position/id para categorias.
Somente produtos ACTIVE, variantes ativas e categorias ativas são expostos.
Produto ausente/inativo retorna 404. Fonte não configurada, indisponível,
incompatível ou com dados inválidos retorna 503 sem caminhos, SQL ou segredos.
O contrato não expõe custo, usuários, pedidos ou dados administrativos.

## Preços, estoque e imagens

SQLite armazena Float no legado. O adaptador lê sua representação textual,
converte para Decimal e arredonda para centavos com ROUND_HALF_UP. Isso não
recupera precisão já perdida na origem. Valores monetários JSON são strings.
Promoção ausente permanece null; não se inventa promoção nem preço efetivo.

Disponível e reservado são retornados separados. A reserva no serviço existente
já decrementa quantityAvailable; não subtrair quantityReserved novamente.
Não há total agregado de estoque. Sem Inventory, os valores são null e a
variante não é declarada disponível. Produto disponível tem alguma variante
ativa com quantity_available > 0. Isso é informação de consulta, não reserva
nem garantia de checkout concorrente.

URLs `/images/...`, `/uploads/...` e absolutas são preservadas literalmente,
inclusive image_url de variantes. A galeria respeita position, com ID como
desempate. primary_image usa a primeira marcada principal; sem marca, usa a
primeira da galeria. Sem imagens retorna null. FastAPI não serve esses arquivos:
URLs relativas devem ser resolvidas contra a origem do Next.js pelo consumidor.
Nenhuma foto é copiada, excluída ou armazenada no PostgreSQL.

## Configuração local e produção

Definir `LEGACY_CATALOG_SQLITE_PATH` no ambiente do processo FastAPI como caminho
absoluto para o SQLite efetivamente usado pelo Next.js. Sem essa variável,
somente o catálogo novo retorna 503; os endpoints atuais continuam disponíveis.
Não há descoberta automática de dev.db nem fallback para backups.
DATABASE_URL continua sendo exclusivamente a configuração SQLAlchemy existente.
O `.env` local não foi modificado.

Pendente de infraestrutura: montar o MESMO banco de forma acessível ao FastAPI,
com permissões e suporte a leituras concorrentes, inclusive arquivos auxiliares
de WAL quando aplicável. Não usar immutable=1 em um banco que recebe escritas.
O acesso readonly depende também das permissões do filesystem SQLite.
O helper Prisma pode copiar o banco para `/tmp` em produção/serverless; essa
cópia efêmera não constitui persistência compartilhada nem fonte confiável
para outra implantação. Não usamos uma cópia temporária como produção.
Não se verificaram registros reais nem implantação externa nesta implementação.
Na inspeção deste checkout não havia `prisma/dev.db`, apenas `dev.backup.db`.
O backup não foi aberto nem usado como fonte. A integração HTTP com o catálogo
real permanece dependente da configuração e da infraestrutura, apesar do
adaptador implementado e validado com bancos sintéticos.

## Segurança e pendências

O seed existente apaga dados e contém credenciais demonstrativas: não executar
para integrar nem usar tais credenciais em produção. POST /products Python
ainda precisa de autenticação/autorização adequada antes de exposição pública.
Não foi criada autenticação provisória nem CORS aberto. O SQLite deve ficar
fora de diretórios públicos. Upload atual grava em public com folder recebido
do cliente e valida MIME informado; revisar confinamento de caminho, conteúdo,
limites e armazenamento persistente em tarefa própria, sem mudanças aqui.
O cadastro legado faz múltiplas operações sem uma transação única envolvendo
todo o produto: o leitor pode observar um cadastro parcialmente confirmado.
Inventário ausente é tratado como desconhecido, sem disponibilidade inventada.

Preparado: contrato HTTP independente da origem e serviço/repositório que
permitem substituir a fonte futuramente. Pendente: frontend consumir FastAPI,
persistência compartilhada, autenticação de escrita, política de imagens em
produção, consolidação de coleções/reviews e plano de migração autorizado.
Coleções e reviews não são expostos nesta primeira interface.

Para consolidar no PostgreSQL: escolher responsável por escritas, inventariar
IDs, definir precisão monetária e regras de estoque, planejar mapeamentos e
reconciliação/idempotência, ensaiar importação em bancos descartáveis, validar
contagens e relações, depois autorizar migração e corte do frontend.

## Validação

Testes usam SQLite sintético temporário, nunca o catálogo real. Cobrem IDs,
preços, imagens, categorias, variantes/estoque, paginação, isolamento de status,
404/503, modo somente leitura, consultas posteriores, ausência de duplicações e
endpoints antigos. Integração PostgreSQL usa TEST_DATABASE_URL temporário.

Executar dentro de backend:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe -m app.agents.openapi_check
```

O snapshot em `docs/openapi.json` inclui as novas rotas. Nenhuma migration
adicional é criada pelo adaptador, e os agentes/Actions existentes são mantidos.

Resultado local em 27/10/2026: 71 testes passaram, sem falhas nem skips,
com Python 3.13 e PostgreSQL 18 descartável. `alembic upgrade head`,
`alembic check`, agente de integridade e agente OpenAPI passaram. Há avisos
existentes de depreciação do TestClient/HTTP 422 e de permissão no cache pytest.
Comparação estrutural do OpenAPI confirmou preservação das operações e schemas
anteriores; foram adicionadas somente as três rotas de catálogo e seus schemas.
Nenhuma execução do GitHub Actions foi realizada nesta tarefa.
