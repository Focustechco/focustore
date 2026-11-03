# Contrato de integração FastAPI / FocusStore

Data: 03/11/2026. Fonte executável do contrato: `/openapi.json`; interface:
`/docs`; referência versionada: `backend/docs/openapi.json`.
São 20 operações em 14 caminhos. O frontend não foi alterado nesta etapa.

## Fontes e identificadores

Há dois domínios distintos, já existentes:

- `/products` e `/categories`: tabelas SQLAlchemy do banco backend, IDs inteiros.
  Produto simples (`name`, `description`, `price`, `stock`, `category_id`).
- `/api/v1/catalog`, cotação, identidade e consulta de pedidos: leitura das
  tabelas Prisma existentes, IDs string, variantes, imagens, relações e estoque
  por variante. Nenhuma dessas rotas grava no SQLite.

**Não troque as URLs `/api/admin/*` do Next.js por `/products` ou `/categories`
simplesmente.** Os contratos e as tabelas são diferentes. Cadastro SQLAlchemy
não aparece automaticamente na vitrine Prisma. Não existe sincronização ou
dual-write. Decidir a unificação é trabalho posterior, com aprovação e plano de
dados. Não use Alembic no banco/tabelas Prisma.

## Configuração e sessão existente

Configure localmente, sem sobrescrever o .env existente:

```dotenv
# backend/.env: exemplos, substitua a URL com valores autorizados no editor.
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/BACKEND_DATABASE
LEGACY_CATALOG_SQLITE_PATH=/absolute/path/to/focustore/prisma/dev.db
FRONTEND_ORIGIN=http://localhost:3000
FOCUS_DEBUG=false
```

`LEGACY_CATALOG_SQLITE_PATH` deve apontar ao **mesmo arquivo ativo** usado por
Next.js, não ao backup nem a uma cópia das sessões. Deve ser absoluto. Seu nome
foi preservado para não introduzir configuração concorrente: agora também é a
fonte de identidades e pedidos. Em implantação com serviços separados, esse
arquivo pode não estar acessível; será preciso aprovar outra ponte de identidade
ou concluir a migração antes de usar esta integração em produção.

O FastAPI usa o cookie `focus_session`, verifica `sessions.expires`, consulta o
usuário e o papel atuais em cada requisição. Não cria senhas, tokens, usuários ou
sessões; login/logout continuam no Next.js. Revogação e alteração de papel são
observadas na próxima consulta. Data Prisma em milissegundos e exportações ISO
são aceitas; datas ISO sem fuso são interpretadas como UTC.

- Sem sessão, sessão desconhecida/expirada ou usuário removido: 401.
- Escritas: exigem `ADMIN` ou `MANAGER`; `CUSTOMER` recebe 403.
- Escritas com cookie exigem `Origin` igual à origem da API ou a
  `FRONTEND_ORIGIN`; ausência de Origin, Origin `null` e
  `Sec-Fetch-Site: cross-site` são rejeitados com 403.
- Fonte de identidade ausente, ilegível ou inconsistente: 503. Não há fallback
  para usuário padrão, header de papel ou token administrativo inventado.
- CORS credenciado só é habilitado para a origem exata configurada. Sem wildcard.
  Use o mesmo hostname nos dois serviços (ex.: localhost:3000 e localhost:8000),
  não misture localhost com 127.0.0.1. Cookies existentes e SameSite ainda se
  aplicam. CORS sozinho não substitui autenticação.
- Respostas de identidade e pedidos, inclusive erros, usam `Cache-Control:
  no-store` e `Vary: Cookie`.

Em cliente HTTP/Swagger, autentique-se usando a sessão existente por um método
seguro; operações administrativas precisam também de Origin. Não cole tokens
no código, relatórios, URLs ou logs.

## Endpoints

`Público` significa sem cookie; a fonte de dados ainda precisa estar configurada.
Todos os corpos JSON devem usar `Content-Type: application/json`.

| Método e URL | Parâmetros / corpo | Resposta de sucesso | Autorização / erros principais |
| --- | --- | --- | --- |
| GET `/health` | nenhum | 200 `{status, version}` | público; prova de vida, não testa bancos |
| GET `/categories` | `skip>=0`, `limit=1..100` (20 padrão) | 200 array CategoryResponse | público; banco SQLAlchemy |
| GET `/categories/{category_id}` | ID inteiro | 200 CategoryResponse | público; 404 |
| POST `/categories` | CategoryCreate | 201 CategoryResponse | ADMIN/MANAGER; 401/403/409/422/503 |
| PATCH `/categories/{category_id}` | CategoryUpdate parcial | 200 CategoryResponse | ADMIN/MANAGER; 404/409 e erros comuns |
| DELETE `/categories/{category_id}` | ID inteiro | 204 sem corpo | ADMIN/MANAGER; 409 se houver produtos |
| GET `/products` | `skip`, `limit`, `category_id>0`, `q` (1..150 caracteres) | 200 array ProductResponse | público; busca literal sem wildcard do cliente |
| GET `/products/{product_id}` | ID inteiro | 200 ProductResponse | público; 404 |
| POST `/products` | ProductCreate | 201 ProductResponse | ADMIN/MANAGER; categoria inexistente 404 |
| PATCH `/products/{product_id}` | ProductUpdate parcial | 200 ProductResponse | ADMIN/MANAGER; 404/409/422 |
| DELETE `/products/{product_id}` | ID inteiro | 204 sem corpo | ADMIN/MANAGER; 404/409 |
| POST `/products/{product_id}/stock-adjustments` | `{delta: inteiro não zero}` | 200 ProductResponse | ADMIN/MANAGER; limites de estoque 409 |
| GET `/api/v1/catalog/products` | `offset>=0`, `limit=1..100` | 200 CatalogPage[CatalogProduct] | público; 503 sem fonte |
| GET `/api/v1/catalog/products/{slug}` | slug string | 200 CatalogProduct | público; 404/503 |
| GET `/api/v1/catalog/categories` | `offset`, `limit` | 200 CatalogPage[CatalogCategory] | público; 503 |
| GET `/api/v1/catalog/variants/{variant_id}/availability` | ID string, 1..255 caracteres | 200 `{variant_id, quantity_available, available}` | público; 404/503 |
| POST `/api/v1/cart/quote` | CartQuoteInput | 200 CartQuote | público; 404/409/422/503 |
| GET `/api/v1/users/me` | cookie | 200 `{id, name, email, role}` | sessão válida; 401/503 |
| GET `/api/v1/orders` | cookie, `offset`, `limit` | 200 OrderPage | sessão válida; somente próprios; 401/422/503 |
| GET `/api/v1/orders/{order_id}` | cookie, ID string 1..255 | 200 OrderDetail | somente próprio; 401/404/503 |

Erros de domínio usam `{ "detail": "mensagem" }`. Validação Pydantic usa 422 e
`detail` como array de erros. Erros de persistência/identidade retornam mensagens
genéricas, sem SQL, caminhos ou credenciais. Campos extras de entrada dos novos
DTOs de escrita/cotação são rejeitados, não silenciosamente persistidos.

## Formatos e validações

### Catálogo SQLAlchemy

```json
{"name":"Teclado","description":null,"price":"199.90","stock":10,"category_id":1}
```

ProductResponse acrescenta `id` inteiro. `price` é Decimal positivo, até 10
dígitos totais e 2 casas; sai como string decimal. `stock` é inteiro estrito entre
0 e 2147483647; booleanos e frações não são quantidades. `category_id` é inteiro
positivo, validado contra o banco. Nome após trim: 1..150 caracteres.

CategoryCreate: `{ "name": "Periféricos", "slug": "perifericos" }`.
Nome após trim: 1..120; slug: 1..140, único no banco. Não há geração automática
nem normalização de maiúsculas no slug. CategoryResponse inclui ID inteiro.

PATCH exige ao menos um campo. Nulos são rejeitados em campos obrigatórios;
`description: null` é permitido. Categoria com produtos não pode ser excluída.
DELETE remove apenas o registro SQLAlchemy correspondente, sem tocar Prisma;
não há flag de desativação no modelo atual. Nenhum DELETE foi executado em banco
real durante esta implementação.

Ajuste de estoque usa incremento/decremento SQL condicionado a estoque final
válido, com expressão BIGINT para evitar overflow intermediário no PostgreSQL.
Se duas requisições tentarem retirar a última unidade, só uma deve ter sucesso.
Esse comportamento foi ensaiado com concorrência SQLite; PostgreSQL real segue
não testado. PATCH usa bloqueio de linha no PostgreSQL. Não há tabela de
movimentações/auditoria no catálogo SQLAlchemy atual; o endpoint não substitui
um sistema de reservas nem a trilha de estoque Prisma.

### Carrinho: cotação sem persistência

```json
{"items":[{"variantId":"ID_REAL_DA_VARIANTE","quantity":2}]}
```

A variante e a quantidade são as únicas informações aceitas por linha. Não
aceita preço, total, userId, frete ou desconto do cliente. Máximo 100 linhas,
quantidade inteira estrita 1..999 e soma por variante até 999. Itens repetidos
são agrupados antes da verificação de estoque. Carrinho vazio é válido e retorna
subtotal 0.00 sem exigir consulta à fonte.

```json
{
  "items":[{
    "variant_id":"ID_REAL_DA_VARIANTE","product_id":"ID_REAL_DO_PRODUTO",
    "product_name":"Teclado","variant_name":"Preto M","sku":"KEY-M",
    "quantity":2,"unit_price":"169.90","line_total":"339.80"
  }],
  "total_items":2,"subtotal":"339.80","currency":"BRL","reserves_stock":false
}
```

Os números acima são exemplos de contrato, não dados gravados. A cotação lê
preços e estoque em uma transação de leitura consistente; exige produto ACTIVE
e variante ativa. Promoção da variante não nula tem precedência, inclusive zero;
caso contrário usa o preço da variante. `quantity_available` já exclui reservas:
não subtrair `quantity_reserved` novamente. Sem inventário, a disponibilidade é
zero e a cotação com quantidade positiva recebe 409.

A cotação não reserva estoque, não inclui frete, cupom ou pagamento e pode ficar
desatualizada. O checkout que grava pedidos deve recalcular tudo e reservar
atomicamente na mesma transação da compra. Add/remove/update continuam no
carrinho local existente: envie novamente a lista resultante para cotar. Não
foi criado um carrinho persistente concorrente ao localStorage/Prisma.

### Pedidos próprios

OrderPage: `{items, total, offset, limit}`. Cada resumo contém `id`,
`order_number`, `status`, `subtotal`, `discount_amount`, `shipping_amount`,
`total`, `created_at`, `updated_at`. Dinheiro é string decimal; datas são ISO UTC.
OrderDetail acrescenta itens com `id`, `variant_id`, nomes de produto/variante,
`sku`, `unit_price`, `quantity`, `total_price`, `image_url`.

Preços vêm dos snapshots de compra, não do catálogo atual. Consulta não muda o
status nem recompõe valores históricos. Estados existentes no Prisma incluem
PENDING, PAYMENT_PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED e
REFUNDED; esta API apenas os apresenta. Outro usuário, visitante ou pedido
inexistente recebe a mesma resposta 404. Mesmo ADMIN não ganha acesso aos pedidos
de outros usuários por estas rotas. Consulta de visitante por token e consulta
administrativa global não foram adicionadas.

## Exemplos para a equipe frontend

Os exemplos são documentação; não foram inseridos em `src/`.

```typescript
const API = 'http://localhost:8000';

// Depois do login existente no Next.js; cookie HttpOnly segue pelo navegador.
const meResponse = await fetch(`${API}/api/v1/users/me`, {
  credentials: 'include', cache: 'no-store',
});
if (!meResponse.ok) throw new Error(`Sessão indisponível: ${meResponse.status}`);
const me = await meResponse.json();

const quoteResponse = await fetch(`${API}/api/v1/cart/quote`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: cartItems.map(({ variantId, quantity }) => ({ variantId, quantity })) }),
});
if (!quoteResponse.ok) throw new Error(`Carrinho inválido: ${quoteResponse.status}`);
const quote = await quoteResponse.json();
// quote.subtotal é string decimal; usar biblioteca decimal para cálculos,
// ou somente formatá-la na UI. O servidor continua sendo responsável pelo valor.

// Administração do catálogo SQLAlchemy, não do catálogo Prisma da vitrine:
const created = await fetch(`${API}/categories`, {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Periféricos', slug: 'perifericos' }),
});
// Origin é enviado pelo navegador. 401=login, 403=papel/origem, 409=conflito.
```

## Incompatibilidades e decisões pendentes

1. IDs Prisma são strings; IDs SQLAlchemy são inteiros. Não há conversão segura
   automática entre ambos. Categoria Prisma é N:N e hierárquica; no SQLAlchemy
   cada produto tem uma categoria obrigatória.
2. Next usa camelCase, envelopes `{success, products/categories}` em rotas admin,
   números JS e `PUT` em várias atualizações. FastAPI usa snake_case em respostas,
   arrays/páginas explícitas, Decimal string e PATCH parcial. Exige adaptação
   explícita, não substituição direta.
3. O carrinho atual usa localStorage. Novo endpoint apenas cota; não é CRUD de
   carrinho persistente. Pedidos continuam criados pelo checkout Next existente.
4. O checkout Next usa `promotionalPrice || price`; promoção zero na nova cotação
   tem semântica explícita de preço zero. Ele também não tem a mesma política de
   validação de produto ativo da nova cotação. Alinhar antes de trocar o fluxo.
5. Catálogo Next esconde `camisa-dev-collection-csharp` em consultas de vitrine;
   o leitor FastAPI existente consulta ACTIVE e não replica esse filtro. Nenhuma
   alteração no contrato desse leitor foi feita; política compartilhada pendente.
6. Campos administrativos ricos (variantes, imagens, coleções, SEO, dimensões,
   banners, cupons), frete e favoritos continuam em Next; não foram duplicados.
7. A autorização FastAPI não corrige nem certifica a segurança de páginas/rotas
   Next. A revisão observou pontos que precisam de análise da equipe responsável:
   checkout recebe userId do corpo, e estoque usa leitura seguida de atualização
   sem condição SQL de saldo. Nenhum arquivo frontend foi modificado para tratar
   esses pontos.
8. Sem PostgreSQL de desenvolvimento, testes reais do dialeto e conectividade
   seguem pendentes. Migração unificada exige aprovação, backup e ensaio.
