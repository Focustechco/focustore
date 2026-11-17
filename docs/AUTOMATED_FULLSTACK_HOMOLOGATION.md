# Homologação automatizada Next.js → FastAPI → PostgreSQL

Esta suíte valida o catálogo público com os três serviços reais: PostgreSQL
descartável, FastAPI/SQLAlchemy e Next.js. Ela não valida checkout FastAPI,
pagamentos ou escrita comercial; a autoridade de checkout continua no Prisma.

## Pré-requisitos

- Node.js 22.
- Python 3.13 com `backend/requirements.txt` instalado.
- PostgreSQL descartável, local e em loopback.
- Um servidor PostgreSQL descartável com banco de conexão terminado em `_test`
  e usuário autorizado a criar/remover bancos temporários.

Defina apenas para a execução atual:

```powershell
$env:FOCUS_E2E_DATABASE_URL = 'postgresql+psycopg://focusstore:senha@127.0.0.1:5432/focusstore_e2e_test'
$env:FOCUS_PYTHON_EXECUTABLE = 'python'
npm run test:catalog:e2e
```

O teste rejeita hosts não locais, bancos sem sufixo `_test`, portas ausentes e
usuários ausentes e opções de conexão em query string. Ele cria um banco novo
`focusstore_e2e_<UUID da execução>_test`; migrations e seed rodam somente nesse
banco. A seed exige identidade compatível em `FOCUS_E2E_RUN_ID` e rejeita um banco
genérico mesmo se estiver vazio. Não execute a seed isoladamente. O teste aplica
Alembic, verifica `alembic check`, insere fixtures sintéticas, inicia FastAPI e
Next.js e remove o banco criado e o SQLite temporário ao terminar. Nunca aponte
o banco de conexão para um servidor persistente; o isolamento de execução não
substitui essa exigência operacional.

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

## Execução auditada em 17/11/2026

A primeira rodada aprovada corresponde ao commit
`1d07e6b04c9c1bbbe021410ffbb574decb02ecbe`:

- [Frontend, run 44143097214](https://github.com/Focustechco/focustore/actions/runs/44143097214):
  48 testes frontend, 5 fullstack, 4 E2E PostgreSQL e 48 testes após build,
  todos aprovados, sem falhas ou skips. TypeScript, Prisma generate, instalação
  com `npm ci`, build Next.js e `pip check` também passaram.
- [Backend, run 44143102235](https://github.com/Focustechco/focustore/actions/runs/44143102235):
  206 testes aprovados, migrations, `alembic check`, integridade PostgreSQL,
  contrato OpenAPI e `pip check` aprovados.

Esses links são evidência da versão identificada acima. Para commits posteriores,
confira sempre `head_sha` das novas execuções; não reutilize uma execução antiga
como aprovação de código novo.

### Correções encontradas na execução e revisão

- O seed executado por caminho absoluto precisava de `PYTHONPATH` apontando para
  `backend`; apenas mudar o diretório de trabalho não resolve o import de `app`.
- O resumo do seed é capturado antes do commit para evitar acessar atributos ORM
  expirados após fechar a sessão SQLAlchemy.
- A home exibe o preço promocional `R$ 0,00`, enquanto `89.90` é o preço base
  retornado pela API. A suíte confere os dois nos respectivos contratos.
- As assertions de páginas removem scripts, estilos e metadados antes de conferir
  nomes, preços e estoque. Dados presentes apenas no payload RSC não bastam.
- O detalhe da garrafa confere `R$ 0,00` e cinco unidades disponíveis; o da camisa
  confere `99,90` e estoque esgotado. A indisponibilidade exige a mensagem explícita
  de catálogo indisponível após parar o FastAPI.
- A revisão posterior à primeira aprovação adiciona limites aos comandos de setup
  e ao encerramento de processos, além de tentar encerrar ambos os serviços mesmo
  quando um deles falha. Falhas de limpeza continuam sendo reportadas.

### Isolamento e integrações

O PostgreSQL 18 pertence ao container do job e não possui volume persistente.
O SQLite do frontend é temporário; ele atende recursos Prisma e não substitui
o catálogo PostgreSQL. Os cinco testes `test:fullstack` existentes exercitam
persistência Prisma/SQLite e a fronteira legada; os testes de cliente/adapter
incluídos em `npm test` são testes de contrato. A nova suíte é a evidência separada
da cadeia Next.js → FastAPI → SQLAlchemy → PostgreSQL.

Os workflows têm permissão `contents: read`, checkout sem credenciais persistidas
e nenhum passo de deploy. O `vercel.json` desabilita deploy automático somente de
`feature/automated-fullstack-homologation`, conforme a
[configuração Git da Vercel](https://vercel.com/docs/project-configuration/git-configuration).
As consultas ao GitHub após a publicação não mostraram deployments no SHA
`504a2093a101fe446359ab39c3acfc4fe75377b7`; o check Supabase Preview informou que a
branch não está associada a um banco Supabase. A API de hooks não estava acessível
com a credencial disponível (HTTP 404); não houve alteração de hooks ou permissões.

Nenhum código comercial, autenticação, pedidos, pagamentos ou controle de acesso
foi modificado. Checkout FastAPI e simulador de pagamentos permanecem desabilitados
no processo E2E. Não há execução de navegador nem validação visual; as páginas
verificadas são `/`, `/busca?q=Homolog`, `/categoria/homolog-catalog`,
`/produto/homolog-shirt` e `/produto/homolog-bottle`.

### Reprodução no GitHub Actions

Com GitHub CLI autenticado, publique normalmente apenas esta branch e execute:

```sh
gh workflow run frontend-quality.yml --ref feature/automated-fullstack-homologation
gh workflow run backend-quality.yml --ref feature/automated-fullstack-homologation
gh run list --branch feature/automated-fullstack-homologation --event workflow_dispatch
gh run view RUN_ID --log
```

Confira o SHA de ambos os runs contra o HEAD remoto e as contagens TAP do passo
`Automated PostgreSQL catalog homologation`: sete testes, sete aprovados,
zero falhas e zero skips. O E2E usa Next.js em desenvolvimento; a regressão HTTP
com build de produção é executada separadamente por `npm test`.

### Avisos observados

Avisos não bloqueantes: `punycode` e `url.parse()` em actions, actions antigas com
runtime Node 20 forçado para Node 24 pelo runner, tipo de módulo não declarado em
`tailwind.config.ts` e depreciação do uso de `httpx` pelo Starlette TestClient.
O Node da aplicação permanece 22. O `npm ci` reportou zero vulnerabilidades e os
dois `pip check` não encontraram dependências incompatíveis. Atualizar esses
componentes exige validação própria; nenhum aviso foi ocultado nesta homologação.

## Reforços da auditoria de engenharia

A suíte atual também valida busca seletiva, filtros com resultado vazio,
alteração de estoque via SQL comprometida no PostgreSQL refletida na API e no
HTML, e recuperação após reiniciar o FastAPI. O teardown descarta apenas o nome
aleatório criado com sucesso nesta execução. Dez testes backend verificam a
rejeição de URLs inseguras e identidades ausentes/incorretas sem conectar a bancos.
Os números históricos acima continuam associados aos respectivos SHAs, não aos
reforços posteriores. Consulte também `FINAL_ENGINEERING_AUDIT.md`.
