# FocusStore: desenvolvimento no Linux Mint

Diagnóstico local realizado em 03/11/2026. Este guia descreve o checkout atual,
não presume concluída a migração de banco documentada anteriormente.

## Estado inicial

O repositório está em `/home/eduarda/projetos-focus/focus-store/focustore`,
um nível abaixo da pasta aberta inicialmente. Remoto:
`https://github.com/Focustechco/focustore`. Branch `main`, commit `6003759`.
Árvore inicialmente limpa. `HEAD...origin/main` retornou `0 0`: nenhum commit
local pendente em relação à referência disponível. Não foi feito fetch, portanto
isso não confirma a situação atual do servidor. Identidade Git local configurada.
Nenhum pull, merge, commit, push, deploy ou acesso à Vercel foi realizado.

Estavam ausentes `.env`, `.env.local`, `backend/.env`, `node_modules` e
`backend/.venv`. Nenhum arquivo de credenciais existente foi substituído.

## Pré-requisitos e versões

- Linux Mint 22.3, base Ubuntu noble; Bash, Git e acesso aos registros npm/PyPI.
- Node do sistema: 18.19.1 / npm 9.2.0. Node 18 é incompatível com Next 16.4.1
  (mínimo 20.9) e Tailwind oxide (mínimo 20).
- Node **22.23.4** instalado somente em `.local-tools/node_modules/node`.
  `.nvmrc` indica a linha 22. Não foi alterado Node do sistema nem o perfil Bash.
- Python **3.12.3**, ambiente único `backend/.venv`; compatibilidade validada nos
  testes locais. CI usa Python 3.13 e Node 22.
- Lockfile: Next 16.4.1, React/React DOM 19.3.0, TypeScript 5.9.3,
  Tailwind 4.3.3, Prisma/Client 6.19.3, Zod 3.25.76.
- Backend: FastAPI 0.158.2, Uvicorn 0.54.0, Pydantic 2.14.1,
  SQLAlchemy 2.1.6, Alembic 1.20.0, Psycopg 3.3.6, Pytest 9.1.1.
- PostgreSQL, psql e Docker não foram encontrados no PATH. Nenhuma conexão de
  desenvolvimento foi fornecida; nenhum banco interno da empresa foi acessado.

## Dependências e inicialização

Abra um terminal na raiz real:

```bash
cd /home/eduarda/projetos-focus/focus-store/focustore
export PATH="$PWD/.local-tools/node_modules/.bin:$PATH"
node --version
npm --version
```

Repita o `export PATH` em cada terminal novo. Alternativamente, se já tiver nvm,
use `nvm install` e `nvm use` na raiz (o nvm não foi instalado nesta auditoria).
Para recriar apenas o runtime local em outro checkout sem nvm:

```bash
npm install --prefix .local-tools --no-audit --no-fund node@22
export PATH="$PWD/.local-tools/node_modules/.bin:$PATH"
```

Dependências do projeto:

```bash
npm ci
npm run db:generate
# Somente se backend/.venv ainda não existir:
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m pip check
```

`npm ci` reinstala node_modules a partir do lockfile. Não execute em paralelo com
outra instalação npm. As dependências foram instaladas; não houve atualização
intencional de versões nem alteração do package-lock.json. `prisma generate`
gera o cliente e não aplica migrations.

Frontend:

```bash
npm run dev
# http://localhost:3000
```

Backend, após configurar uma conexão autorizada em backend/.env:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# http://127.0.0.1:8000/health
# http://127.0.0.1:8000/docs
```

O script `scripts/dev-fullstack.ts` escolhe `bin/python` no Linux e
`Scripts/python.exe` no Windows. A política `catalog-policy` está presente.
O script exige uma configuração própria para o PostgreSQL do backend; não
reaproveite a URL do Prisma e não executa migrations automaticamente.

## Arquivos de ambiente e credenciais

Foi criado um `.env` local, ignorado e com permissão 600, contendo somente:
SQLite já existente, URLs localhost, mock de pagamento e seed desabilitado.
Não contém senhas ou credenciais OAuth. `.env.local` não foi necessário.

O exemplo da raiz agora corresponde ao provider SQLite implementado:

```dotenv
DATABASE_URL="file:./dev.db"
```

O caminho é relativo a `prisma/schema.prisma`, apontando para `prisma/dev.db`.
Next lê `.env.local` com precedência sobre `.env`; o CLI Prisma lê `.env`.
Evite definir bancos diferentes nesses arquivos ou exportar DATABASE_URL no
terminal e esquecer de removê-la. Não copie a URL SQLite para o backend.

Para preparar o backend sem sobrescrever arquivos:

```bash
cp -n backend/.env.example backend/.env
chmod 600 backend/.env
# Abra backend/.env no editor e substitua os placeholders localmente.
```

URL SQLAlchemy esperada: `postgresql+psycopg://USER:PASSWORD@localhost:5432/DB`.
Não use literalmente os placeholders. O backend lê backend/.env por caminho
absoluto, independentemente do diretório atual. Variáveis exportadas no terminal
têm precedência; não exporte a URL do frontend ao iniciar o backend.

Para login social, configure localmente `SOCIAL_LOGIN_ORIGIN`, um segredo de
pelo menos 32 bytes (`SOCIAL_LOGIN_SECRET`, ou fallback `NEXTAUTH_SECRET`) e:

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e callback autorizado.
- Apple: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`;
  exige domínio HTTPS e não funciona com localhost/IP como origem web.

Consulte `docs/SOCIAL_LOGIN.md` para callbacks. Gere segredos no gerenciador de
senhas ou ferramenta local segura; não envie valores no chat nem em logs.
O login por e-mail/CPF usa senha bcrypt e sessão própria em banco; o código
inspecionado não é um fluxo de magic link por e-mail.

## Bancos existentes e divergência de migração

**Frontend real:** `prisma/schema.prisma` usa `provider = "sqlite"`. O cliente
aceita URL `file:`. `prisma/dev.db` e `prisma/dev.backup.db` existem e ambos são
rastreados pelo Git, apesar das regras de ignore. Em modo somente leitura,
ambos retornaram `PRAGMA integrity_check = ok`, zero violações de FKs e 30 tabelas.
Isso verifica consistência estrutural, não reconciliação financeira ou origem
autoritativa dos dados. Nenhum registro foi impresso ou alterado.

**Divergência:** `prisma/migrations/migration_lock.toml` e a migration inicial
`20261028202545_initial_postgresql` são PostgreSQL. `.env.example` antes apontava
para PostgreSQL e `docs/POSTGRES_MIGRATION.md` afirmava que o provider já fora
alterado. Isso não corresponde ao schema deste HEAD. Testes frontend também
exigem PostgreSQL. Não basta instalar PostgreSQL ou trocar DATABASE_URL:
schema, migrations, código e testes precisam de decisão conjunta.

**Backend:** SQLAlchemy possui tabelas próprias `categories` e `products`,
com IDs inteiros e histórico Alembic independente. O adaptador legado lê
SQLite em modo somente leitura quando configurado por
`LEGACY_CATALOG_SQLITE_PATH=/caminho/absoluto/prisma/dev.db`.
Não aponte Alembic para as tabelas Prisma; há nomes de tabelas em comum e
modelos diferentes. Use bancos separados para frontend e backend numa eventual
migração. O /health é uma prova de vida e não verifica PostgreSQL.

### PostgreSQL de desenvolvimento no notebook

A usuária informou que ainda não possui uma instância. Os comandos abaixo são
instruções para instalação local; **não foram executados**. Não é necessário
acessar a rede da empresa.

```bash
sudo apt update
sudo apt install postgresql postgresql-client
sudo systemctl enable --now postgresql
sudo -u postgres createuser --pwprompt focusstore_backend_dev
sudo -u postgres createdb --owner=focusstore_backend_dev focusstore_backend_dev
pg_isready -h 127.0.0.1 -p 5432
psql -h 127.0.0.1 -U focusstore_backend_dev -d focusstore_backend_dev -W -c 'SELECT 1;'
```

Verifique antes se a role/banco já existe. `--pwprompt` solicita uma senha
escolhida pela usuária; não reutilize senhas de produção. Configure backend/.env
no editor com esses valores, codificando caracteres especiais da senha na URL.
Não coloque senha na linha de comando. Um banco remoto só deve ser usado com
autorização e regras TLS/rede fornecidas pelo responsável.

### Migrations com segurança

Nenhuma migration foi aplicada aos bancos existentes. Não execute `npm run
db:push`, seeds, reset ou migrate deploy neste checkout inconsistente.
Primeiro decida se o frontend continuará SQLite ou concluirá a migração para
PostgreSQL. Preserve backup consistente e ensaie restauração antes de qualquer
alteração. Ignore não remove arquivos já rastreados.

Para o backend, depois de confirmar que backend/.env aponta exclusivamente ao
banco de desenvolvimento correto, é possível inspecionar:

```bash
cd backend
.venv/bin/python -m alembic history
.venv/bin/python -m alembic heads
# Consulta o estado no banco configurado; só após validar o destino:
.venv/bin/python -m alembic current
```

Somente após aprovação da migration e backup, execute manualmente
`.venv/bin/python -m alembic upgrade head`, seguido de
`.venv/bin/python -m alembic check`. O banco novo de desenvolvimento também
precisa dessa revisão. Nunca use essas instruções automaticamente em produção.
Os testes Pytest usam fixtures temporárias próprias, inclusive migrations de
ida/volta em SQLite temporário; não modificam os bancos existentes.

## Validação realizada

| Verificação | Resultado |
| --- | --- |
| Instalação npm pelo lockfile com Node 22 | FUNCIONANDO |
| Geração Prisma Client 6.19.3 | BLOQUEADA: `query_engine-windows.dll.node` estava em uso pelo Next dev local; não foi encerrado processo alheio |
| SELECT 1 via Prisma no SQLite existente | FUNCIONANDO |
| Integridade/FKs dos dois SQLite | FUNCIONANDO |
| TypeScript | `npm run typecheck` passou |
| Build Next isolado | `npx next build` passou; todas as rotas compilaram |
| `npm run build` | BLOQUEADO antes do Next build pelo bloqueio do DLL durante `prisma generate` |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| Pytest | 114 aprovados, 5 pulados, 1 aviso de depreciação Starlette/httpx |
| Uvicorn real + HTTP /health | HTTP 200, SQLite em memória, sem PostgreSQL |
| Smoke test de produção: `/`, `/api/auth/session`, `/colecoes` | HTTP 200 |
| Imagens visíveis na home | Sem imagens quebradas no navegador |
| `npm test` e `npm run test:fullstack` | BLOQUEADOS sem `FOCUS_TEST_DATABASE_URL` PostgreSQL descartável; o provider Prisma atual continua SQLite |
| PostgreSQL real / integridade Alembic em PostgreSQL | CONFIGURAÇÃO PENDENTE |
| OAuth Google/Apple real | CONFIGURAÇÃO PENDENTE |
| Integração de pagamento real e upload persistente em produção | NÃO CONFIGURADOS/VALIDADOS |

O build do Next mostra um aviso de overhead de módulo no `tailwind.config.ts`.
O smoke test não simulou compras nem escreveu em dados reais. Um teste isolado
com SQLite validou preço promocional, limite de cupom, idempotência de pagamento,
estoque e histórico de status; ele não substitui a suíte PostgreSQL.

Comandos de testes a partir da raiz:

```bash
export PATH="$PWD/.local-tools/node_modules/.bin:$PATH"
npm run typecheck
npm test
npm run test:fullstack
npm run build
(cd backend && DATABASE_URL=sqlite:///:memory: .venv/bin/python -m pytest -q -ra)
backend/.venv/bin/python -m pip check
```

`DATABASE_URL=sqlite:///:memory:` só configura o bootstrap da coleta Pytest; as
fixtures criam bancos temporários por teste. Os cinco testes pulados exigem
`TEST_DATABASE_URL` para PostgreSQL local descartável terminado em `_test`.
O frontend exige `FOCUS_TEST_DATABASE_URL` com banco descartável `_test`; a
variável não foi fornecida e o provider do Prisma segue SQLite. Nunca forneça
URLs reais de desenvolvimento/produção aos testes destrutivos.

## Correções realizadas nesta auditoria

Os auxiliares que estavam ausentes e impediam typecheck/build foram
implementados:

- `src/lib/security/origin.ts`: checagem de origem em login social.
- `src/lib/security/upload.ts`: auxiliares de validação de upload.
- `src/lib/auth/guest-order.ts`: validação de acesso a pedido de visitante.
- `src/modules/catalog/catalog-policy.ts`: política de visibilidade do catálogo.
- `src/modules/catalog/product-validation.ts`: validação de produtos.
- `src/modules/cart/cart-validation.ts`: validação de carrinho.
- `scripts/seed-safety.cjs`: proteção dos scripts de seed.

Também foram corrigidos validação de produto/carrinho/upload, autorização de
pedidos de visitantes, idempotência e titularidade do pagamento simulado,
status de pedidos administrativos, filtragem de catálogo e handles SQLite nos
testes Windows. O pagamento simulado está desativado em produção.

Outras alterações: removida chave lint duplicada/obsoleta do package.json
(mantido lint como typecheck), `.nvmrc`, exemplos de ambiente coerentes com SQLite
e caminhos Linux, proteção de `.local-tools` e bancos no .gitignore e este guia. Criados localmente `.env`, `.local-tools`,
`node_modules`, `.next` e `backend/.venv`; esses artefatos são ignorados.

## Windows, Linux e Git

- Use `backend/.venv/bin/python`; não copie uma venv Windows. Ativação opcional:
  `source backend/.venv/bin/activate`.
- Linux diferencia maiúsculas/minúsculas. Caminhos locais devem usar `/`;
  LEGACY_CATALOG_SQLITE_PATH deve ser absoluto e apontar ao banco correto.
- `VAR=valor comando` é sintaxe Bash; PowerShell usa `$env:VAR`.
- Os scripts npm atuais não exigem PowerShell. Nenhum caminho de produção ou
  componente visual foi alterado.
- `.env`, `.env.local`, backend/.env, node_modules e .venv estão ignorados.
  Confirme com `git check-ignore .env backend/.env backend/.venv/bin/python`.
- Há dois bancos e cinco arquivos .pyc já versionados. Ignore não os protege de
  futuros commits enquanto continuarem rastreados. Não use `git add .` sem
  revisar `git diff --cached --stat`. Nenhum banco, backup ou .pyc foi removido
  nem retirado do índice nesta auditoria; uma limpeza de rastreamento pode ser
  planejada separadamente, preservando cópias locais e histórico.
- Não publique os bancos locais por conterem potencialmente dados reais.

## Problemas comuns e próximos passos

Node incompatível: repita o export PATH e confira `node --version`.
Dependência nativa faltando: execute uma única instalação `npm ci` com Node 22;
não reutilize node_modules de Windows. Erro de conexão npm/PyPI: revise rede/DNS;
não altere versões do lockfile apenas para contornar falta de rede.
Google Fonts exige rede durante build; não foi substituída a fonte/design.
`database_url Field required`: configure backend/.env ou use exclusivamente o
bootstrap de teste documentado. Porta ocupada: escolha outra com `--port`.
Módulo ausente: reinstalar npm não recupera arquivos TypeScript do projeto.

Prioridades pendentes: decidir a migração de SQLite para PostgreSQL sem perder
dados; preparar PostgreSQL isolado para as suítes frontend; liberar/reexecutar
`prisma generate` sem encerrar processos do usuário; configurar e validar OAuth,
gateway de pagamento real e armazenamento de imagens persistente para produção.
Não foram usados dados reais ou URLs de produção em testes.
