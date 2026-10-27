# Recuperação segura e validação fullstack — 27/10/2026

## Resultado e limites

Trabalho sobre `main`, HEAD `581bc52`, preservando o diff não commitado da
auditoria anterior. Não houve reset, seed, restauração sobre banco existente,
migração de dados, alteração de schema real, commit, push ou deploy.

| Componente | Classificação | Evidência |
| --- | --- | --- |
| Frontend local | APROVADO | TypeScript, build e testes HTTP/funcionais |
| Backend local | APROVADO | Pytest, OpenAPI, disponibilidade e política de escrita |
| Persistência SQLite local | APROVADO | Originais íntegros; cadastro/produto sintéticos persistiram após reinícios |
| PostgreSQL local | APROVADO | Leitura readonly na instância configurada; heads e integridade corretos; migrations/testes em instância descartável |
| Integração de catálogo | APROVADO | HTTP Next.js → mesmo arquivo SQLite → HTTP FastAPI, preservando IDs/valores e alterações posteriores |
| Produção Vercel | NÃO VERIFICADO | Sem painel, variáveis, storage ou execução remota; operação comercial continua bloqueada por infraestrutura/gateway/autorização pendentes |

Não é uma integração completa de APIs: o frontend continua lendo/escrevendo pelo
Prisma. FastAPI lê o mesmo catálogo local, sem copiar para PostgreSQL, e o
frontend ainda não consome os endpoints FastAPI. Não existe banco compartilhado
durável entre implantações remotas nem sincronização bidirecional.

## 1. Bancos realmente encontrados

Caminhos relativos à raiz do repositório:

| Banco | Usuários | Produtos | Categorias | Variantes | Pedidos | Integridade/FKs |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `prisma/dev.db` | 2 | 11 | 7 | 57 | 0 | integrity_check OK; zero violações |
| `prisma/dev.backup.db` | 4 | 19 | 7 | 56 | 2 | integrity_check OK; zero violações |

Foram encontradas 30 tabelas em cada arquivo. Ambos estavam em journal_mode
delete, sem WAL/SHM no momento da inspeção, e user_version 0. Os schemas SQL são
iguais. A comparação dos IDs de usuários, produtos, categorias, variantes e
pedidos mostrou **nenhum ID em comum**. São conjuntos de dados distintos; maior
contagem ou tamanho não identifica uma cópia como mais recente/autoritativa.
Não houve união, deduplicação, sobrescrita ou troca pelo backup.

No início não havia `.env`/`.env.local`/`.env.development*` do frontend nem
DATABASE_URL herdada do processo. O código anterior selecionava `prisma/dev.db`
por fallback. Nenhum servidor Next.js estava identificado como ativo; portanto,
a escolha inicial foi comprovada pelo caminho do código/configuração disponível,
não por presumir o ambiente de um processo remoto.

Agora `.env.development.local` (ignorado pelo Git) define explicitamente
`DATABASE_URL="file:./dev.db"`. O caminho relativo é resolvido contra `prisma/`,
resultando em `prisma/dev.db` na raiz atual. O helper converte para caminho
absoluto/canônico antes de abrir o Prisma. Isso preserva a fonte que o código
usava antes, sem escolher arbitrariamente o arquivo de backup.

`backend/.env` já existia e foi mantido intacto. A DATABASE_URL SQLAlchemy usa
PostgreSQL local na porta 5432. Credenciais, nomes de usuários do banco, e-mails,
CPFs, tokens e hashes de senha não são reproduzidos neste relatório.
LEGACY_CATALOG_SQLITE_PATH estava ausente; passa a ser fornecida pelo launcher
local com o MESMO caminho canônico usado pelo Next.js.

Os bancos permanecem fora do índice Git. Retirá-los do índice não os excluiu do
disco. Backups e fixtures têm diretórios ignorados próprios; nenhum arquivo de
banco deve ser adicionado ao commit.

## 2. Backups consistentes antes de mudar configuração

Antes da configuração de persistência, foram gerados backups novos dos DOIS
arquivos pela API `sqlite3.Connection.backup`, com origem em `mode=ro` e snapshot
de leitura. Esse procedimento considera o estado transacional/WAL, ao contrário
de copiar apenas o arquivo principal enquanto há escritas.

Local dos backups verificados:

```text
.local-backups/fullstack-20261027T192427Z-87e827df/dev.db
.local-backups/fullstack-20261027T192427Z-87e827df/dev.backup.db
.local-backups/fullstack-20261027T192427Z-87e827df/manifest.json
```

Cada destino era novo, sem sobrescrever arquivo anterior. Foram verificados
integrity_check, foreign_key_check e igualdade das contagens com o snapshot de
origem. O manifesto registra hashes SHA-256 e contagens, sem dados pessoais.
O hash dos arquivos originais foi conferido antes/depois; nenhuma mudança foi
necessária neles. O conteúdo binário de um backup SQLite pode diferir em
metadados de página; a validação não se baseia apenas em tamanho/hash igual.

`.local-backups/` está ignorado pelo Git. Não há rotina de limpeza automática dos
backups. Fixtures novas ficam em `.local-validation/`, também ignorado, e são
mantidas para inspeção. Nenhum backup foi transformado em fonte principal.

## 3. Revisão das alterações anteriores

O diff da auditoria foi revisto por áreas: autorização, sessões, upload,
transações administrativas, estoque/pagamento, Prisma/configuração, adaptador,
rotas/schemas FastAPI, integridade, CI, scripts e documentação. Foram preservados:

- Autorização administrativa próxima das consultas, cookies seguros e validações.
- Arquivamento de produtos/desativação de categorias, sem apagar histórico.
- Transações de produto/variante/estoque e bloqueio de variante de outro produto.
- Reserva condicional e transições/idempotência de pagamentos.
- Proteção de upload, remoção de detalhes internos em respostas e guards de seed.
- Checkout/webhook fictícios bloqueados em produção.
- Escrita FastAPI desabilitada por padrão e sempre em produção.
- Remoção somente do índice dos bancos/bytecodes, sem apagar cópias locais.
- Remoção do router duplicado de schemas, mantendo as rotas funcionais existentes.

Regressões/lacunas corrigidas nesta etapa:

1. A ausência de configuração ainda selecionava um banco por fallback. Agora
   DATABASE_URL explícita é obrigatória; ausente/inacessível/inválido falha antes
   de construir o Prisma Client, sem criar outro SQLite vazio.
2. A existência do arquivo não era verificada antes da abertura. Agora há
   abertura readonly do arquivo e validação do cabeçalho SQLite antes do Prisma.
3. Não havia uma configuração que ligasse automaticamente a fonte Next.js ao
   adaptador local. O launcher resolve uma vez e passa a mesma origem aos dois.
4. Os testes anteriores não reiniciavam os dois serviços para comprovar a
   persistência. A nova suíte faz reinícios reais de processos e novas consultas.
5. O frontend ocultava um slug por merchandising, mas o adaptador expunha todos
   os ACTIVE. A regra existente foi extraída sem alterar seu conteúdo e passada
   ao FastAPI pelo launcher; consultas usam parâmetros, inclusive nas exclusões.

No banco ativo há 11 produtos ACTIVE; um é excluído pela política existente.
Com o launcher, ambos os catálogos públicos exibem os mesmos 10 registros, sem
modificar status, IDs ou dados. Em uma execução FastAPI separada, configurar
LEGACY_CATALOG_EXCLUDED_SLUGS explicitamente se essa política for necessária.

## 4. Inicialização local segura

```powershell
# Na raiz, com dependências instaladas e bancos existentes verificados:
npm run db:generate
npm run dev:fullstack
```

O comando inicia:

- Next.js em `http://127.0.0.1:3000`.
- FastAPI em `http://127.0.0.1:8000/docs`.
- FastAPI com LEGACY_CATALOG_SQLITE_PATH igual ao caminho SQLite canônico do
  frontend e a mesma lista de slugs ocultos.
- SQLAlchemy com sua configuração PostgreSQL separada, nunca com a URL SQLite
  do frontend. Usa backend/.env existente ou FOCUS_BACKEND_DATABASE_URL explícita.
- APP_ENVIRONMENT=development e ALLOW_LOCAL_WRITES=false no FastAPI.

`Ctrl+C` encerra os processos iniciados. Não executa seed, db push, migrations,
criação de arquivo de banco ou importação de dados. Não é comando de produção.
Se um serviço encerrar inesperadamente, o outro também é encerrado.

Portas podem ser definidas por FOCUS_FRONTEND_PORT e FOCUS_BACKEND_PORT (distintas).
FOCUS_PYTHON_EXECUTABLE permite selecionar Python 3.13; por padrão usa a venv
backend/.venv e, se ausente, o executável python do ambiente.

`npm run dev` continua iniciando apenas o Next.js, com a configuração explícita
em `.env.development.local`. Em outro checkout esse arquivo não estará no Git:
configurar manualmente uma DATABASE_URL que aponte para um SQLite existente e
verificado. Não copiar um backup por conveniência nem executar seed para ocultar
erro de arquivo ausente. Não copiar exemplos de configuração sobre arquivos reais.

Produção/build não carregam `.env.development.local`. Exigem DATABASE_URL própria
e banco/schema preparado. A retirada dos DBs do Git implica que um clone/deploy
novo não contém dados: isso é intencional. O CI prepara um schema descartável
explicitamente; a aplicação não faz bootstrap silencioso de banco vazio.

## 5. Cadastro e sessão: prova além de HTTP 200

`npm run test:fullstack` cria um arquivo NOVO em `.local-validation/fullstack-*`
e aplica o schema Prisma somente nele. Next.js e FastAPI são processos locais
reais, iniciados pelo mesmo launcher usado em desenvolvimento.

O teste cria usuário por HTTP e verifica diretamente:

- linha em users, ID estável, hash diferente da senha e bcrypt.compare válido;
- linha de sessão persistida, remoção no logout e nova sessão no login;
- usuário e sessão ainda existentes após encerrar e iniciar os serviços;
- consulta da sessão e novo login funcionando depois do reinício;
- rejeição de e-mail duplicado sem criar outro usuário.

Credenciais são exclusivamente sintéticas, domínio example.test, sem tocar nas
contas do banco ativo. A suíte frontend existente também verifica autorização,
CPF, expiração, Secure em produção, limites e erros sem detalhes internos.

## 6. Catálogo e integração comprovada

No MESMO arquivo sintético:

1. Primeiro FastAPI lê catálogo vazio válido (não uma falha mascarada).
2. Usuário sintético recebe papel admin apenas no banco novo de teste.
3. Categoria e produto são criados via APIs administrativas Next.js existentes,
   com galeria por URLs sintéticas, variante, preço/promoção e estoque.
4. Prisma/CatalogService e HTTP FastAPI retornam os mesmos IDs, SKU, valores,
   URLs, categoria, variante e quantidades, com Decimal serializado em strings.
5. Atualização administrativa aparece na consulta seguinte do FastAPI.
6. Ambos os processos são reiniciados, e os dados completos continuam iguais.
7. Paginação e política de merchandising continuam consistentes.
8. Hash do arquivo antes/depois das leituras FastAPI confirma ausência de alteração.
9. POST Python continua 503, sem tentativa de gravar no catálogo ou PostgreSQL.

A DATABASE_URL SQLAlchemy desse teste aponta deliberadamente para uma porta
inacessível, sem senha. Assim não há conexão de escrita nem cópia dos produtos
para PostgreSQL. O teste comprova independência do adaptador, não disponibilidade
PostgreSQL. Os testes PostgreSQL são executados separadamente.

As imagens de teste são referências sintéticas, não fotos comerciais. URLs
relativas continuam pertencendo à origem Next.js; FastAPI não passou a servir
arquivos de imagem. Nenhuma imagem real foi copiada, excluída ou sobrescrita.

## 7. Responsabilidade pelas escritas

| Entidade/operação | Responsável atual |
| --- | --- |
| Usuários, hashes, sessões | Next.js/Prisma/SQLite |
| Catálogo, imagens/URLs, variantes e associações | Painel/API administrativa Next.js, em transação |
| Estoque e movimentos | Serviços Next.js, com atualizações condicionais/transacionais |
| Pedidos, reserva e pagamento demonstrativo local | Serviços Next.js; mock bloqueado em produção |
| Catálogo lido pelo FastAPI | Adaptador independente SQLite mode=ro/query_only, sem gravações |
| Produtos/categorias inteiros PostgreSQL | Endpoints Python legados; escrita bloqueada por padrão, não publicam na loja |

Nenhuma sincronização de usuários, produtos ou pedidos foi adicionada.
IDs UUID/String não são convertidos em inteiros. Não somar estoques de variantes
nem descontar reservas duas vezes; disponível/reservado são campos separados.

## 8. PostgreSQL existente e validação isolada

Na instância configurada em backend/.env, porta 5432:

- conexão confirmada; transaction_read_only verificado como on;
- categories=0 e products=0, sem importar produtos SQLite;
- revision atual e head do repositório: e0dd9a760a45;
- agente de integridade readonly aprovado.

Nenhuma migration/check com potencial DDL foi executada contra essa instância.
Para Alembic e Pytest foi criado PostgreSQL 18 independente, temporário, na porta
55441. As migrations históricas foram aplicadas SOMENTE nele; não foram criadas
novas migrations nem alterados schemas existentes reais.

## 9. Segurança e histórico

Os guards de autorização, upload, seed, transação, checkout e webhook da auditoria
foram preservados. Não há autenticação improvisada no FastAPI; POSTs continuam
indisponíveis até existir autorização adequada. O launcher não habilita escrita.

Nenhum `.env` real está rastreado atualmente. A revisão readonly do histórico
encontrou um `.env` antigo (commit 60f59f7) com uma chave sensível não vazia.
Os valores não foram exibidos, copiados ou restaurados. backend/.env não foi
encontrado no histórico consultado. Os bancos antigos também permanecem no
histórico Git; removê-los do índice não limpa versões anteriores.

Avaliar exposição, rotacionar credenciais potencialmente expostas e revogar
sessões com autorização operacional. Não houve reescrita do histórico nem
tentativa de acessar variáveis/painel Vercel. Backups reais locais devem ser
protegidos como dados sensíveis, embora não estejam no Git.

## 10. Produção Vercel e plano PostgreSQL (não executado)

Não há evidência de persistência durável, storage de objetos, variáveis privadas
ou gateway real na implantação. SQLite em /tmp não é persistência definitiva.
Upload serverless e pagamentos fictícios continuam bloqueados. Configurar uma
URL não transforma um filesystem efêmero em armazenamento seguro.

Plano incremental para uma migração autorizada:

1. Inventariar os datasets reais e decidir qual é autoritativo por domínio.
   Não unir dev.db e dev.backup.db por ID: não há IDs em comum nas entidades
   comparadas. Produzir reconciliação de negócios em ambiente isolado.
2. Fazer backup consistente final SQLite/WAL, verificar integridade/FKs/contagens
   e ensaiar restauração. Provisionar PostgreSQL durável com TLS, backups e
   permissões mínimas; registrar schemas, versões e responsáveis por DDL.
3. Projetar Prisma PostgreSQL sem perder UUIDs, hashes bcrypt, sessões/expirações,
   categorias, variantes, estoque, carrinhos e pedidos. Definir precisão Numeric
   para moeda e mapa explícito para IDs inteiros do backend.
4. Um único dono de migrations por tabela. Prisma pode manter inicialmente o
   domínio existente; SQLAlchemy usa schema separado para as entidades legadas,
   sem autogenerate conflitante sobre tabelas Prisma compartilhadas.
5. Importar idempotentemente em PostgreSQL de homologação, preservando relações,
   histórico de pedidos e imagens. Reconciliar contagens/valores e relatar
   inválidos/duplicatas sem excluir automaticamente usuários ou pedidos.
6. Migrar imagens para storage de objetos com checksum e preservação/mapeamento
   de URLs. Não usar public/ efêmero para novos uploads de produção.
7. Alterar provider/schema Prisma, DATABASE_URL Prisma e SQLAlchemy, autorização
   FastAPI e proprietário de cada escrita em mudança revisada. Sem dual-write
   informal nem sincronização bidirecional de emergência.
8. Homologar HTTP, restart, permissões, concorrência, preços, estoque, sessões,
   upload e gateway de sandbox assinado. Só então configurar Vercel e fazer
   deploy autorizado, com verificação real HTTPS e persistência entre instâncias.

### Rollback

Não restaurar automaticamente um backup sobre qualquer banco real. Para uma
falha local de configuração, interromper os serviços e voltar apenas o ponteiro
para o mesmo arquivo previamente verificado, sem copiar arquivos por cima.

Se houver necessidade de restauração de dados: obter autorização explícita,
congelar escritas, criar outro backup consistente do estado atual, restaurar
o backup selecionado em um caminho NOVO, verificar integridade/FKs/contagens e
reconciliar escritas posteriores. Só depois aprovar a troca de configuração.
Preservar a origem e o estado anterior até concluir a validação.

No corte PostgreSQL, manter backup restaurável e registrar escritas após corte.
Não voltar ao SQLite descartando novos usuários/pedidos. Aplicação e schema
devem ser revertidos juntos, respeitando compatibilidade e dono de migrations.

## 11. Arquivos incrementais e execução

- `src/lib/db/database-url.ts` e `prisma.ts`: configuração explícita, validação
  readonly de arquivo/cabeçalho e caminho canônico antes do Prisma.
- `scripts/dev-fullstack.ts`, package/lock e `@next/env`: ambiente Next carregado
  pela API oficial instalada, inicialização conjunta e isolamento das duas URLs.
- `.env.development.local`: ponteiro local ignorado; nenhum segredo incluído.
- `catalog-policy.ts`, CatalogService e configuração/service/repository FastAPI:
  mesma exclusão de merchandising, com SQL parametrizado e total/paginação coerentes.
- `tests/fullstack.test.ts`: cinco testes reais HTTP com reinícios e conferência
  de linhas no SQLite; nenhum banco comercial é usado.
- `tests/store.test.ts`: fixtures sintéticas preservadas, sem limpeza de DBs.
- backend/tests: isolamento da configuração e regressão da política de exclusão.
- `.gitignore`: backups e fixtures fora do Git.
- workflow frontend: Python 3.13/dependências e teste fullstack, além das verificações
  anteriores. Não há deploy nem operação em banco remoto.

Comandos de validação seguros (criam apenas fixtures novas):

```powershell
npm run typecheck
npm test
npm run test:fullstack
```

Build e modo de produção foram executados com DATABASE_URL apontando para banco
sintético novo, com schema preparado somente nele; nunca para os arquivos reais.
Pytest/Alembic/agentes foram executados com DATABASE_URL/TEST_DATABASE_URL do
PostgreSQL descartável. Não executar db push, seed ou migrations nos bancos reais
como forma de contornar uma falha de inicialização.

Os resultados finais de validação são registrados abaixo.

## 12. Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm run test:fullstack` | 5 testes passaram; cadastro/sessão e catálogo após reinícios reais |
| `npm test` | 16 testes passaram em desenvolvimento |
| `npm run build` | PASS, 37 páginas geradas, SQLite de build novo/sintético |
| `FOCUS_TEST_PRODUCTION=1 npm test` | 16 testes passaram contra next start |
| `tsc --noEmit` | PASS |
| `python -m pytest -q -ra --tb=short` | 85 passed, sem falhas nem skips, com PostgreSQL descartável |
| `python -m alembic upgrade head` / `alembic check` | PASS no PostgreSQL descartável; sem divergências |
| `python -m app.agents.openapi_check` | PASS, sem alteração adicional do contrato nesta etapa |
| Agente de integridade | PASS no PostgreSQL existente readonly e no descartável |
| Originais SQLite após todas as validações | Ambos presentes; hashes SHA-256 iguais aos anteriores aos backups |
| `actionlint` | PASS nos workflows frontend/backend |
| `git diff --check` / `git diff --cached --check` | PASS |

Não houve falha final de teste. Permanecem avisos locais já conhecidos de
depreciação TestClient/HTTP 422, cache pytest e interpretação ESM de
tailwind.config.ts. Não foram ocultados com flags de tolerância a erro.

Na revisão final, os DBs/bytecodes reapareceram no índice sem restauração feita
pela implementação. Foram novamente retirados APENAS do índice e verificados
no disco. Não houve sobrescrita de conteúdo nem remoção de registro.

O PostgreSQL descartável da porta 55441 e os servidores de teste foram
encerrados. A instância existente da porta 5432 foi mantida. Backups e fixtures
sintéticas foram preservados, sem limpeza automática de .db.

## 13. Pendências para revisão

1. Revisar o diff acumulado antes de commit/push, incluindo as correções anteriores
   e o novo teste fullstack. Executar o workflow real no GitHub após envio autorizado;
   a validação local não comprova execução Linux/Node 22 no runner.
2. Decidir a autoridade de negócios dos datasets dev.db/dev.backup.db antes de
   qualquer recuperação/união; preservar ambos e os backups verificados.
3. Avaliar o segredo e os DBs do histórico, com rotação/revogação autorizada.
4. Provisionar persistência durável e storage, homologar gateway e autorização de
   escrita, configurar Vercel e testar a implantação real. Nada disso foi presumido.
5. Adoção dos endpoints FastAPI pelo frontend e consolidação PostgreSQL são etapas
   futuras, com mudanças revisadas no contrato e na responsabilidade por escritas.
