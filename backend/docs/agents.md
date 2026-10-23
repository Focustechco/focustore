# Agentes internos do FocusStore

São verificações determinísticas, sem LLM, serviços pagos ou dependências novas de aplicação.

## Diagnóstico e escopo

Inspeção realizada na branch `back-end`. O backend possui `Category` (id, name,
slug), schemas `CategoryCreate` e `CategoryResponse`, `GET /health` e
`POST /categories`. A persistência usa SQLAlchemy síncrono e psycopg, com
configuração central em `app/config.py` e sessões em `app/db/session.py`.
Não há camada de serviços Python separada. O frontend usa outra arquitetura,
Next.js/Prisma, e não faz parte destas verificações.

A revisão `7ec8ee7c05e5` é vazia; `b24f91c73a60` cria categories. Ambas foram
preservadas. Os testes existentes usam SQLite temporário. Já havia uma tentativa
local não rastreada dos agentes e do workflow: foi completada, sem substituir a
arquitetura. Não foi encontrada configuração versionada que permita confirmar
como o deploy de produção é feito. Nenhum deploy foi alterado ou executado.

Python local e CI: 3.13. As dependências continuam em `backend/requirements.txt`.

## Preparar o ambiente

No PowerShell, a partir da raiz do repositório:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:APP_NAME = 'FocusStore API'
$env:APP_VERSION = '0.1.0'
$env:FOCUS_DEBUG = 'false'
$env:DATABASE_URL = 'postgresql+psycopg://usuario:senha@localhost:5432/focusstore_dev'
```

Use um banco de desenvolvimento. Não copie credenciais reais para comandos
versionados. Também é possível usar o `.env` local já suportado pelo projeto.
Nos exemplos seguintes, o ambiente virtual deve estar ativo e o diretório deve
ser `backend`. No Linux, ative com `source .venv/bin/activate` e defina variáveis
usando `export NOME=valor`.

## Database Integrity Agent

```powershell
python -m app.agents.integrity
```

Reutiliza Settings e SQLAlchemy. Verifica conectividade, todas as heads do
Alembic, tabela/colunas, tipos e tamanhos, chave primária, NOT NULL e unicidade
do slug. Procura nomes/slugs vazios, slugs duplicados e comprimentos inválidos.
Não cria tabelas, não aplica migrations e não corrige dados.

Todas as consultas executam em uma transação PostgreSQL REPEATABLE READ,
READ ONLY, com timeout de consulta de 15 segundos e de lock de 3 segundos.
A conexão tem timeout de 5 segundos. O relatório mostra regras e contagens,
sem valores de registros, URLs ou mensagens brutas de exceções.

`PASS` e código 0 significam que as verificações passaram. `FAIL` e código 1
indicam inconsistência ou impossibilidade de completar a inspeção.
Confira o banco selecionado, conectividade, permissões e migrations. Aplique
`python -m alembic upgrade head` somente no banco de desenvolvimento ou no
banco temporário de CI, após revisar as migrations. O agente não as aplica.

Para adicionar uma regra, confirme primeiro o modelo e a regra de negócio;
adicione uma consulta SELECT agregada ao dicionário `checks` em
`app/agents/integrity.py`. Se depender de novas colunas, valide sua existência
antes da consulta. Adicione um teste com dados válidos e inválidos no PostgreSQL
temporário. Não registre dados pessoais nem implemente correções automáticas.

## API Documentation Agent

```powershell
python -m app.agents.openapi_check
# Após revisar uma alteração intencional no contrato:
python -m app.agents.openapi_check --write
git diff -- docs/openapi.json
```

Gera o OpenAPI nativo do FastAPI e compara com `docs/openapi.json`. Não há
documentação de rotas duplicada manualmente. A exportação ordena as chaves e
mantém formato JSON estável; diferenças apenas na ordem das chaves são ignoradas.
Não conecta ao banco, mas a importação da aplicação exige DATABASE_URL válida.
Mantenha APP_NAME e APP_VERSION nos valores usados para gerar a referência.

O relatório usa caminhos JSON Pointer (por exemplo, `/paths/~1categories/post`).
`ADDED` identifica uma nova rota/operação; `POTENTIALLY BREAKING` identifica
remoções ou modificações; `REVIEW` identifica adições que podem afetar clientes,
como restrições, segurança ou campos obrigatórios. Parâmetros, schemas e
respostas são comparados integralmente, inclusive referências em components.

Qualquer diferença reprova a verificação, inclusive adições compatíveis. Essa
classificação é conservadora: mudanças descritivas e reordenação de listas podem
ser sinalizadas. Não é uma prova completa de compatibilidade semântica. Respostas
não declaradas no FastAPI (como erros construídos diretamente nas rotas) não
podem ser verificadas por este agente. Revise o diff e os consumidores da API.

`--write` é uma ação explícita local; é bloqueada quando CI=true/1 ou
GITHUB_ACTIONS=true. A verificação normal jamais altera a referência. Revise
e versione a referência junto da alteração de API aprovada.

## Testes e PostgreSQL temporário

```powershell
python -m pytest -q -ra
```

Sem TEST_DATABASE_URL, somente os testes de integração PostgreSQL são pulados;
os testes existentes e os testes unitários dos agentes continuam executando.
No CI, a ausência dessa variável causa falha em vez de skip.

Para rodar todas as integrações, inicie um PostgreSQL descartável local, crie um
banco com nome terminado em `_test` e configure explicitamente:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://usuario:senha@127.0.0.1:5432/focusstore_test'
python -m pytest -q -ra
```

O teste recusa hosts remotos e nomes que não terminem em `_test`. Isso é uma
proteção contra erro, não uma garantia de que um banco local seja descartável:
selecione uma instância criada exclusivamente para testes. Cada teste cria um
schema aleatório, aplica as migrations nele e remove somente esse schema no fim.
DDL e dados inválidos existem apenas nessas fixtures; o agente continua somente
leitura. Os testes também comprovam que o PostgreSQL bloqueia uma tentativa de
escrita na transação do agente e verificam códigos de saída e ocultação de segredos.

## GitHub Actions

`.github/workflows/backend-quality.yml` roda em PRs destinados a `back-end`
quando houver mudanças em `backend/**` ou no próprio workflow. Também permite
execução manual em Actions > Backend quality (no deploy) > Run workflow.

O job usa Python 3.13 e PostgreSQL 18 temporário do runner. Instala os requirements,
aplica as migrations, executa `alembic check`, todos os testes e ambos os agentes.
APP_NAME e APP_VERSION são fixados para manter a referência estável. O serviço
usa credenciais descartáveis, sem secrets de produção. A permissão do token é
somente `contents: read`; o checkout não persiste credenciais. Não há deploy,
push, merge ou atualização automática da referência.

Na página do PR, abra o check Backend quality e os logs de cada etapa. O resumo
do job indica o resultado geral. Testes precisam passar sem skips de integração.
Falha em install: confira a disponibilidade das versões fixadas e Python 3.13.
Falha em migrations/check: revise a cadeia e a divergência dos modelos, sem editar
migrations antigas. Falha de integridade: confira a regra citada e a preparação
do banco temporário. Falha OpenAPI: revise os caminhos e atualize a referência
localmente somente se a mudança for intencional. Não use secrets para contornar
falhas de PRs. Uma execução remota só pode ser confirmada após publicar as
alterações autorizadas e observar o resultado no GitHub.

## Validação desta entrega

Em 23/10/2026, no Windows com Python 3.13 e PostgreSQL 18 temporário:

- `pytest -q -ra --tb=short -p no:cacheprovider`: 30 aprovados, nenhum skip;
  inclui os 11 testes existentes e 19 novos, dos quais cinco usam PostgreSQL.
- `alembic upgrade head`: ambas as revisões aplicadas somente na instância temporária.
- `alembic check`: nenhuma divergência entre modelos e banco.
- Ambos os agentes: código 0 e relatório PASS.
- `pip check`: nenhuma dependência quebrada.
- `actionlint 1.7.7`: workflow aprovado, sem diagnósticos.
- `/health` validado pelo TestClient na suíte existente; nenhuma fonte
  previamente rastreada foi excluída e nenhum frontend ou migration foi alterado.

Há um aviso de depreciação do Starlette/TestClient sobre httpx. A primeira
tentativa no sandbox encontrou restrições de acesso a arquivos temporários e
à inicialização do PostgreSQL; a execução autorizada fora do sandbox passou.
O PostgreSQL utilizado nos testes foi uma instância separada em loopback,
porta 55439, e foi encerrado após as verificações. O banco existente não foi usado.
O workflow foi validado localmente; ainda não houve execução remota no GitHub.
O teste preliminar `test_agent_checks.py`, que aceitava qualquer conjunto de
rotas não vazio, foi substituído pelos testes específicos dos dois agentes.

Referências técnicas: [transações somente leitura no PostgreSQL](https://www.postgresql.org/docs/17/sql-set-transaction.html)
e [consulta das revisões do Alembic](https://alembic.sqlalchemy.org/en/latest/api/runtime.html).
