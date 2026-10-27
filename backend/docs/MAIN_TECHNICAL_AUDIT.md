# Auditoria técnica da main — 27/10/2026

Validação posterior, inventário readonly dos bancos e prova de persistência entre
Next.js e FastAPI: [FULLSTACK_INTEGRATION_VALIDATION.md](FULLSTACK_INTEGRATION_VALIDATION.md).
Os resultados abaixo registram a auditoria inicial; a validação posterior
complementa suas evidências sem restaurar bancos ou desfazer as proteções.

## Escopo, evidência e classificação

Base: `main`, HEAD inicial `581bc52`. A árvore estava limpa e `git diff --check`
não apontava problemas antes das alterações. Não houve commit, push, deploy,
seed, reset, migração de produção nem acesso ao painel Vercel. Dados e imagens
existentes não foram alterados. Os testes usam somente dados sintéticos.

Classificação: **ESTÁVEL LOCALMENTE**, sujeita aos resultados de validação abaixo.
Não significa pronta para produção. Persistência durável, autenticação de escrita
FastAPI e integração com gateway real ainda são bloqueios para operação comercial.
A auditoria cobre os módulos descritos; não constitui pentest, garantia de
ausência de vulnerabilidades ou validação de uma implantação remota.

## Arquitetura real

- Next.js 16.4.1 / React / TypeScript. Prisma 6.19.3 usa SQLite, inclusive para
  usuários, hashes, sessões, catálogo, variantes, estoque, carrinhos e pedidos.
  Não usa o PostgreSQL FastAPI como banco compartilhado.
- FastAPI / Python 3.13 / SQLAlchemy / Alembic / PostgreSQL 18. Endpoints de
  produtos/categorias com IDs inteiros e adaptador opcional do catálogo Prisma
  somente leitura, preservando IDs String e referências de imagens.
- Sessões Next.js são tokens aleatórios de 32 bytes persistidos em `sessions`,
  consultados no servidor, com validade e cookie HttpOnly/SameSite=Lax/Secure em
  produção. Senhas são hashes bcrypt. Cadastro cria usuário e sessão em transação.
- `LEGACY_CATALOG_SQLITE_PATH` é independente de `DATABASE_URL`. Sem fonte válida,
  apenas o catálogo adaptado responde 503; health e APIs independentes continuam.
- Imagens existentes são URLs em ProductImage e variantes. O upload original
  gravava diretamente em `public/`. Não existe storage de objetos configurado.
- O pagamento atual é uma demonstração. Não há integração comprovada de gateway
  real, conciliação, expiração automática de reservas ou validação de assinatura
  de provedor real.

## Problemas concretos e correções

| Prioridade | Problema identificado | Correção/evidência |
| --- | --- | --- |
| Crítica | Páginas administrativas consultavam pedidos/auditoria sem autorização | Verificação por sessão e papel em cada página server, layout e serviço administrativo; API já protegida, agora também verifica Origin |
| Crítica | Checkout aceitava userId arbitrário e confirmação usava apenas ID do pedido | Identidade vem da sessão; leitura exige proprietário ou concessão de convidado assinada/expirável; teste HTTP nega leitura não autorizada |
| Crítica | Upload aceitava path traversal, SVG ativo, MIME declarado e tamanho ilimitado | Pastas permitidas, nome UUID, limite real de stream de 5 MB + overhead, magic bytes/MIME, decodificação/recodificação sharp e limite de 25 milhões de pixels |
| Crítica | POSTs FastAPI sem autenticação pública | Escrita desabilitada por padrão e sempre em produção; opt-in apenas development/test até existir autorização compartilhada válida |
| Alta | Exclusão de produto apagava order_items, inventário e relacionamentos | DELETE agora arquiva o produto. Histórico, variantes e imagens permanecem; categoria é desativada preservando associações |
| Alta | Produto/variante/estoque e edição de relacionamentos parcialmente gravados | Transações Prisma abrangem criação e edição; falha de FK/SKU desfaz tudo; variante de outro produto é rejeitada |
| Alta | Edição parcial podia apagar promoção/imagem e trocar preço de variante | Campos omitidos preservam os valores anteriores; regressão ao alterar apenas estoque |
| Alta | Estoque fictício 50 criado automaticamente | Novo produto sem estoque informado inicia em zero; valores negativos/fracionários são rejeitados |
| Alta | Reserva fazia leitura seguida de decremento incondicional | updateMany condicionado a quantidade suficiente; liberação/baixa exige reserva suficiente; operações com movimentos em transação |
| Alta | Novo eventId podia baixar estoque novamente; falha tardia liberava pedido pago | Evento e transição em transação; CAS PENDING; estado terminal não regride; replay com payload diferente é conflito |
| Alta | Cliente podia criar pedido comercial com PIX fictício | Checkout e webhook demonstrativos respondem 503 em produção; webhook de desenvolvimento exige administrador |
| Alta | URL SQLite explícita era ignorada e banco copiado para /tmp | Caminho configurado respeitado; sem cópia automática ou mutação global de DATABASE_URL; produção sem configuração ou com /tmp é recusada |
| Alta | SQLite principal e backup versionados | Removidos somente do índice Git, arquivos locais preservados. Histórico permanece e precisa de avaliação de exposição |
| Alta | Dependências com avisos conhecidos | Zod atualizado para 4.6.6+; override de deepmerge-ts 8 no @prisma/config, validado com Prisma generate/schema/build/testes |
| Alta | Seeds com credenciais demonstrativas e exclusões sem proteção | Requer opt-in, banco explicitamente *_demo.db/*_test.db e ambiente fora de produção; senhas vêm do ambiente e são validadas antes de exclusões |
| Média | Produtos/variantes inativos acessíveis por detalhes/coleções | Filtros ACTIVE/isActive em consultas públicas, mantendo exclusões de merchandising existentes |
| Média | Falha de banco retornava catálogo vazio como sucesso | Erro operacional genérico propagado, sem expor SQL/dados; falha sintética tem regressão |
| Média | Cupons futuros/limite zero e consulta fora da transação | Validação de início/validade/valores, consulta no tx e incremento de uso condicionado; cupom inválido não é silenciosamente ignorado |
| Média | Valores financeiros e número de pedido frágeis | Decimal no arredondamento, centavos inteiros nos totais; valores do servidor; identificador de pedido aleatório no lugar de count+1 |
| Média | Limite bcrypt era por caracteres, permitindo truncamento UTF-8 | Máximo de 72 bytes além do limite de caracteres; CPF não numérico deixa de ser ignorado |
| Média | Sem contenção local de tentativas de autenticação | Limites de login/cadastro por processo e store limitado; isso não substitui rate limit distribuído nem proxy confiável |
| Média | LocalStorage podia restaurar carrinho malformado | Validação de tipos/quantidades/preços e limite no tamanho/restauração; servidor continua sendo responsável por preço e estoque |
| Média | Respostas/logs incluíam erros internos do ORM | Mensagens públicas genéricas; remoção dos objetos de erro em logs de rotas; logging bruto automático Prisma desabilitado |
| Média | Router duplicado em app/schemas/products.py | Removido arquivo sem consumidores; implementação única em api/routes/products.py |
| Média | N+1 no adaptador: 2 + 3N SELECTs | Relações carregadas em lote: cinco SELECTs para página não vazia; teste de contagem e testes de equivalência |
| Média | Agente verificava apenas categorias | Incluídos schema, CHECKs, FK, preço, estoque e órfãos de products; regressão remove constraints só em schema descartável |
| Alta | CI não executava na main e frontend sem pipeline | Backend aceita main/back-end; frontend novo valida geração, TS, testes, build e testes HTTP de produção; sem deploy |

## Mudanças operacionais intencionais

1. PostgreSQL Python permanece essencial e separado. Não foram criadas migrations
   novas nem alteradas as históricas. Escrita local requer
   `APP_ENVIRONMENT=development` e `ALLOW_LOCAL_WRITES=true`; não expor essa opção
   em rede. O padrão `production` recusa escrita mesmo se o flag estiver true.
2. Autorização de convidado na confirmação não usa o ID como senha. Cookie
   HttpOnly com HMAC-SHA256 liga ID, prazo de duas horas e segredo de sessão.
   Produção exige NEXTAUTH_SECRET de pelo menos 32 bytes; em desenvolvimento a
   chave alternativa é aleatória por processo (reinício invalida concessões).
   Um novo pedido convidado substitui a concessão anterior. Uma solução durável
   de acesso a múltiplos pedidos convidados fica para integração real.
3. O webhook demonstrativo exige admin em desenvolvimento. O botão de simulação
   não autoriza clientes a confirmar pagamentos. Gateway real deverá verificar
   assinatura, provedor, referência, moeda e valor, sem confiar no navegador.
4. Upload em Vercel/Lambda retorna 503 até existir storage persistente. Upload local
   recodifica apenas novos arquivos; SVG novo é recusado, imagens antigas mantidas.
   `sharp` passou a dependência direta por ser usado na validação (já era usado
   pelo Next.js). `/uploads/**` foi incluído em next/image localPatterns.
5. `npm run lint` era `next lint`, comando removido nesta versão. Agora é alias
   explícito de typecheck; não há alegação de análise ESLint completa.
6. Seeds e scripts antigos de mutação não foram executados. `verify-store.ts`
   agora falha com assert real e exige a mesma proteção de banco demo/teste.
7. Catálogo indisponível agora gera falha operacional em vez de uma loja vazia
   fictícia; monitoramento/alertas externos ainda precisam ser configurados.

## Segurança do repositório e dos dados

Não foram encontrados arquivos `.env` reais rastreados, apenas exemplos. Os
arquivos locais `.env` não foram editados. Busca por padrões comuns de chaves
privadas/tokens nos diretórios de código não encontrou correspondências; isso
não prova ausência de todo tipo de segredo.

Os bancos SQLite rastreados podem conter dados pessoais, hashes e sessões.
Não foram abertos nem incluídos nos testes. Removê-los do índice não limpa o
histórico. Avaliar exposição, invalidar sessões e rotacionar credenciais
potencialmente expostas em operação autorizada. Não houve reescrita de histórico.
Senhas demonstrativas históricas devem ser consideradas públicas; removê-las
do seed não muda as contas existentes. Desativação/rotação depende do operador.

Avisos consultados: [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
e [deepmerge-ts GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
A falha deepmerge exige objetos recursivos, que JSON simples não cria; o uso
identificado é a configuração Prisma, não um endpoint de merge de objetos.
O override é uma medida revisável e deve ser removido quando o Prisma incorporar
a versão corrigida oficialmente. Auditorias não substituem atualização contínua.

## Infraestrutura: conhecido versus não comprovado

- Vercel: sem acesso ao painel, variáveis, logs, storage ou teste remoto.
  Não há evidência de PostgreSQL configurado nem de persistência de cadastros.
- SQLite em filesystem efêmero perde dados em novos deploys, réplicas e reinícios.
  Copiar um arquivo para /tmp não resolve persistência nem concorrência entre
  instâncias. O código agora falha explicitamente em vez de fazer essa cópia.
- Configurar DATABASE_URL SQLite explícita em produção só é aceitável em um
  filesystem comprovadamente durável e adequado ao SQLite; não basta definir
  uma variável na Vercel. Remover os bancos do índice também significa que um
  deploy novo não receberá uma cópia dos dados via Git.
- Adaptador FastAPI precisa de acesso ao MESMO SQLite e seus arquivos auxiliares
  quando aplicável. Nenhuma sincronização de usuários/produtos/pedidos foi criada.
- Imagens novas precisam de storage de objetos persistente; preservar caminhos
  existentes com mapeamento de URLs antes de qualquer migração.
- Rate limit em memória não é global. Configurar proxy confiável e proteção
  distribuída; forwarded-for não é uma identidade confiável fora dessa fronteira.
- Autenticação existente não inclui recuperação de senha/e-mail transacional,
  MFA, auditoria de login ou revogação central automatizada. Esses serviços não
  foram inventados. Cookies e permissões foram testados localmente.

## Plano incremental de PostgreSQL persistente compartilhado (não executado)

1. Provisionar banco durável, TLS, backups com restauração ensaiada, credenciais
   de mínimo privilégio e ambientes separados. Medir volumes e coletar backup
   consistente do SQLite, incluindo WAL quando necessário; usar checksums.
2. Definir um dono de migrations por tabela. Proposta: Prisma mantém inicialmente
   usuários/sessões/catálogo/carrinhos/pedidos existentes; SQLAlchemy mantém suas
   tabelas legadas em schema separado. FastAPI não cria tabelas Prisma homônimas
   nem executa autogenerate sobre elas. Um único pipeline revisado aplica DDL.
3. Projetar schema canônico UUID/String e mapa explícito dos IDs inteiros Python.
   Preservar UUIDs sem conversão, FKs e referências de variantes/imagens. Escolher
   Numeric/Decimal para preços e regras documentadas de arredondamento.
4. Ensaiar importação idempotente de usuários, contas e sessões em banco de teste.
   Preservar hashes bcrypt e expirações. Decidir revogação de sessões por exposição;
   não restaurar senhas demonstrativas nem tokens comprometidos. Validar duplicatas
   de email/CPF sem apagar usuários automaticamente.
5. Importar categorias/hierarquia, coleções, produtos, imagens ordenadas, variantes,
   inventários disponível/reservado e movimentos. Não somar estoques de variantes
   nem subtrair reserva duas vezes. Reconciliar contagens, chaves e totais.
6. Importar carrinhos, favoritos, pedidos/itens, pagamentos, históricos, cupons,
   endereços e reviews com as mesmas referências e snapshots financeiros.
   Tratar registros inválidos por relatório/revisão, nunca exclusão automática.
7. Migrar arquivos para storage persistente com inventário/checksum e preservação
   ou redirecionamento de URLs. Conferir imagens principais, galerias e variantes.
8. Definir proprietário único das escritas por entidade; migrar Next.js para schema
   Prisma PostgreSQL em branch revisada. Só então integrar autorização FastAPI e
   checkout real. Não implementar dual-write informal ou sincronização bidirecional.
9. Executar homologação completa: cadastro/login/logout, cookies, permissões,
   estoque concorrente, idempotência, pagamento assinado, upload, catálogo e build.
10. Corte autorizado com janela de manutenção ou replicação formal reconciliada,
    backup final, aplicação de migrations e validação de contagens/totais.
    Rollback: manter SQLite original intacto e backup restaurável, registrar todas
    as escritas após o corte e definir como reconciliá-las antes de voltar. Não
    alternar de banco descartando pedidos criados depois do corte.

## Testes e validação

Os testes Node criam um SQLite temporário novo, aplicam schema somente nele e
iniciam Next.js local. Cobrem cadastro, CPF, email duplicado, hash, login/logout,
expiração, cookies, admin, rollback, variante estrangeira, edição parcial,
checkout com identidade do servidor, preço/frete, reservas, eventos repetidos,
arquivamento sem apagar pedidos, catálogo indisponível, upload e carrinho.
Também há modo `FOCUS_TEST_PRODUCTION=1 npm test`, que usa `next start` após build
e valida cookies Secure e bloqueio dos pagamentos fictícios em produção.

Backend usa SQLite sintético e PostgreSQL descartável. Cobertura inclui os
contratos existentes, readonly do adaptador, imagens/UUIDs, cinco queries por
página, indisponibilidade, opt-in de escrita e integridade de products/categories.

Workflows: `Backend quality (no deploy)` / `verify` e
`Frontend quality (no deploy)` / `verify`; push/PR para main e back-end, permissões
contents:read, sem credenciais persistentes de checkout e sem deploy. Validação
local de YAML/expressões com actionlint; nenhuma execução remota foi afirmada.

Resultados finais e inventário de arquivos estão registrados ao fim deste documento.

## Resultados obtidos

| Comando/verificação | Resultado local |
| --- | --- |
| `python -m pytest -q -ra --tb=short` | 83 passed; sem falhas ou skips, com PostgreSQL temporário |
| `python -m alembic upgrade head` | Aplicadas somente ao PostgreSQL descartável |
| `python -m alembic check` | Nenhuma divergência de models/migrations |
| `python -m app.agents.integrity` | PASS, incluindo categories/products |
| `python -m app.agents.openapi_check` | PASS; snapshot atualizado com respostas 503 de escrita |
| `npm test` | 16 testes passaram com Next dev e banco sintético |
| `FOCUS_TEST_PRODUCTION=1 npm test` | 16 testes passaram contra next start e banco sintético distinto |
| `tsc --noEmit` | PASS, após gerar Prisma Client |
| `npm run build` | PASS, 37 páginas geradas, banco de build descartável |
| `npm audit --json` | Zero vulnerabilidades reportadas após correções |
| `uvx pip-audit -r backend/requirements.txt --no-deps` | No known vulnerabilities found nas dependências listadas |
| `actionlint` dos dois workflows | PASS, incluindo expressões GitHub |
| `git diff --check` e `git diff --cached --check` | PASS |

Ambiente local: Windows, Python 3.13, Node 24.21.0, Next 16.4.1,
PostgreSQL 18. O workflow frontend seleciona Node 22; execução Linux/Node 22 no
GitHub ainda não comprovada. Não foram usados usuários/cartões/estoque reais.
Os servidores de teste são encerrados ao terminar a suíte.

Falhas encontradas durante a validação foram corrigidas: Prisma Client ainda
não gerado causava erros TS; preparação do SQLite Windows exigiu criar arquivo
vazio antes de aplicar schema; tipagem do ambiente nos testes foi ajustada;
runner.temp não é permitido no env do job, então o workflow configura o caminho
em uma etapa via GITHUB_ENV. Nenhum resultado negativo foi ocultado com flags.

Avisos remanescentes: API TestClient/httpx e nome HTTP 422 depreciados no backend,
permissão do cache pytest local e interpretação de tailwind.config.ts como ESM
no build. Não bloqueiam os comandos; não foi feita uma mudança global para
type:module, que alteraria scripts CommonJS existentes.

Os dois bancos SQLite e cinco arquivos pyc foram retirados exclusivamente do
índice, com cópias locais mantidas. Isso fica staged para revisão; as demais
correções não foram commitadas. Não houve alteração de migrations nem modelos
relacionais, somente validações de entrada e comportamento das operações.

## Pendências priorizadas

1. **Antes de operação comercial:** banco durável e backups restauráveis,
   storage de objetos, gateway assinado/conciliação e autorização de escrita
   FastAPI. Não reativar mock de pagamento em produção.
2. **Segurança operacional:** avaliar bancos e credenciais do histórico,
   rotacionar o que estiver exposto e revogar sessões comprometidas com autorização;
   configurar rate limit distribuído, proxy confiável, monitoramento e alertas.
3. **Homologação:** executar os workflows no GitHub após revisão e envio;
   validar Linux/Node 22, produção com HTTPS, cadastro em persistência durável,
   imagens, restauração e todos os fluxos com gateway de sandbox real.
4. **Consolidação:** aplicar o plano PostgreSQL somente com autorização explícita,
   contrato canônico e responsáveis por migrations/escritas; sem dual-write informal.
5. **Evoluções não simuladas:** recuperação de senha/e-mail, múltiplos pedidos
   convidados com acesso durável, expiração/reconciliação de reservas, eventual
   paginação das telas administrativas e observabilidade externa.


## Inventario final de arquivos para revisao

| Arquivo | Motivo |
| --- | --- |
| `.env.example` | Configuracao documentada, sem segredos reais. |
| `.github/workflows/backend-quality.yml` | Validacao automatica na main/back-end, sem deploy. |
| `.github/workflows/frontend-quality.yml` | Validacao automatica na main/back-end, sem deploy. |
| `backend/.env.example` | Configuracao documentada, sem segredos reais. |
| `backend/app/__pycache__/__init__.cpython-313.pyc` | Retirada de bytecode do indice, copia local preservada. |
| `backend/app/__pycache__/__init__.cpython-314.pyc` | Retirada de bytecode do indice, copia local preservada. |
| `backend/app/__pycache__/main.cpython-313.pyc` | Retirada de bytecode do indice, copia local preservada. |
| `backend/app/__pycache__/main.cpython-314.pyc` | Retirada de bytecode do indice, copia local preservada. |
| `backend/app/agents/integrity.py` | Verificar tambem schema, constraints, FK e dados de produtos. |
| `backend/app/api/routes/categories.py` | Validacao de entrada, protecao de escrita ou logs seguros. |
| `backend/app/api/routes/products.py` | Validacao de entrada, protecao de escrita ou logs seguros. |
| `backend/app/api/write_access.py` | Validacao de entrada, protecao de escrita ou logs seguros. |
| `backend/app/config.py` | Validacao de entrada, protecao de escrita ou logs seguros. |
| `backend/app/db/session.py` | Validacao de entrada, protecao de escrita ou logs seguros. |
| `backend/app/integrations/legacy_catalog/repository.py` | Eliminar N+1, mantendo transacao e acesso readonly. |
| `backend/app/schemas/category.py` | Validacao de entrada, protecao de escrita ou logs seguros. |
| `backend/app/schemas/product.py` | Validacao de entrada, protecao de escrita ou logs seguros. |
| `backend/app/schemas/products.py` | Remocao de router duplicado sem consumidores. |
| `backend/docs/CATALOG_INTEGRATION.md` | Contrato, diagnostico, operacao e resultados de validacao. |
| `backend/docs/MAIN_TECHNICAL_AUDIT.md` | Contrato, diagnostico, operacao e resultados de validacao. |
| `backend/docs/openapi.json` | Contrato, diagnostico, operacao e resultados de validacao. |
| `backend/tests/__pycache__/test_health.cpython-313-pytest-9.1.1.pyc` | Retirada de bytecode do indice, copia local preservada. |
| `backend/tests/conftest.py` | Regressoes isoladas de escrita, integridade e consultas em lote. |
| `backend/tests/test_catalog.py` | Regressoes isoladas de escrita, integridade e consultas em lote. |
| `backend/tests/test_integrity_agent.py` | Regressoes isoladas de escrita, integridade e consultas em lote. |
| `backend/tests/test_write_access.py` | Regressoes isoladas de escrita, integridade e consultas em lote. |
| `next.config.ts` | Permitir otimizacao de imagens em /uploads/. |
| `package-lock.json` | Dependencias corrigidas, scripts de qualidade e sharp direto. |
| `package.json` | Dependencias corrigidas, scripts de qualidade e sharp direto. |
| `prisma/dev.backup.db` | Retirada do banco do indice, dados locais preservados. |
| `prisma/dev.db` | Retirada do banco do indice, dados locais preservados. |
| `prisma/seed.ts` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `scripts/seed-all-products.js` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `scripts/seed-banners.js` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `scripts/seed-customers.js` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `scripts/seed-rich-variants.js` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `scripts/seed-safety.cjs` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `scripts/update-images.js` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `scripts/verify-store.ts` | Protecao de mutacoes demo/teste e remocao de senhas fixas. |
| `src/app/(store)/checkout/confirmacao/[orderId]/page.tsx` | Identidade do servidor, precisao monetaria e demonstracao bloqueada em producao. |
| `src/app/(store)/checkout/page.tsx` | Identidade do servidor, precisao monetaria e demonstracao bloqueada em producao. |
| `src/app/admin/auditoria/page.tsx` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/app/admin/dashboard/page.tsx` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/app/admin/layout.tsx` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/app/admin/pedidos/page.tsx` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/app/admin/produtos/[id]/editar/page.tsx` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/app/admin/produtos/catalogo-pdf/page.tsx` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/app/admin/produtos/novo/page.tsx` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/app/api/admin/banners/[id]/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/banners/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/categories/[id]/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/categories/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/coupons/[id]/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/coupons/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/customers/[id]/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/customers/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/app/api/admin/inventory/[id]/route.ts` | Ajuste de estoque validado e transacional com movimento. |
| `src/app/api/admin/inventory/route.ts` | Reserva/baixa/liberacao condicionadas e transacionais. |
| `src/app/api/admin/products/[id]/route.ts` | Validacao, transacoes, propriedade de variantes e arquivamento. |
| `src/app/api/admin/products/route.ts` | Validacao, transacoes, propriedade de variantes e arquivamento. |
| `src/app/api/admin/upload/route.ts` | Upload confinado, limitado e validado/recodificado. |
| `src/app/api/auth/login/route.ts` | Autorizacao, cookies, validacao e protecao de sessao. |
| `src/app/api/auth/register/route.ts` | Autorizacao, cookies, validacao e protecao de sessao. |
| `src/app/api/auth/session/route.ts` | Autorizacao, cookies, validacao e protecao de sessao. |
| `src/app/api/checkout/route.ts` | Identidade do servidor, precisao monetaria e demonstracao bloqueada em producao. |
| `src/app/api/checkout/validate-coupon/route.ts` | Identidade do servidor, precisao monetaria e demonstracao bloqueada em producao. |
| `src/app/api/payments/webhook/route.ts` | Idempotencia e transicoes terminais; webhook demo restrito. |
| `src/app/api/shipping/calculate/route.ts` | Remover detalhes internos de respostas/logs e preservar operacao existente. |
| `src/lib/auth/admin.ts` | Autorizacao, cookies, validacao e protecao de sessao. |
| `src/lib/auth/guest-order.ts` | Autorizacao, cookies, validacao e protecao de sessao. |
| `src/lib/db/database-url.ts` | Respeitar SQLite configurado e eliminar copia efemera automatica. |
| `src/lib/db/prisma.ts` | Respeitar SQLite configurado e eliminar copia efemera automatica. |
| `src/lib/security/input-error.ts` | Erros publicos controlados, Origin e contencao local de abuso. |
| `src/lib/security/origin.ts` | Erros publicos controlados, Origin e contencao local de abuso. |
| `src/lib/security/rate-limit.ts` | Erros publicos controlados, Origin e contencao local de abuso. |
| `src/lib/security/upload.ts` | Upload confinado, limitado e validado/recodificado. |
| `src/modules/admin/admin.service.ts` | Verificacao de autorizacao antes de consultas administrativas. |
| `src/modules/cart/cart-context.tsx` | Validacao de carrinho persistido e quantidades. |
| `src/modules/cart/cart-validation.ts` | Validacao de carrinho persistido e quantidades. |
| `src/modules/catalog/catalog.service.ts` | Validar catalogo e filtrar inativos, expondo falhas operacionais. |
| `src/modules/catalog/product-validation.ts` | Validar catalogo e filtrar inativos, expondo falhas operacionais. |
| `src/modules/checkout/checkout.service.ts` | Identidade do servidor, precisao monetaria e demonstracao bloqueada em producao. |
| `src/modules/inventory/inventory.service.ts` | Reserva/baixa/liberacao condicionadas e transacionais. |
| `src/modules/orders/order.service.ts` | Autorizacao de alteracao e estado anterior correto no log. |
| `src/modules/payments/payment.service.ts` | Idempotencia e transicoes terminais; webhook demo restrito. |
| `src/modules/promotions/coupon.service.ts` | Validade de cupons e consulta dentro da transacao. |
| `tests/store.test.ts` | Regressoes HTTP e de dominio em SQLite sintetico/Next local. |
