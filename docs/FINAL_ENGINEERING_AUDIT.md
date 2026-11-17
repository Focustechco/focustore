# Auditoria de engenharia e prontidão para integração — 17/11/2026

## Escopo e evidências

Revisão dos seis commits `f4c4ddd`, `31b4b46`, `504a209`, `4bd12f6`, `1d07e6b`
e `7f8fdd2`, do diff completo contra `origin/main` e das fronteiras relevantes do
catálogo, checkout, reservas e outbox. Esta auditoria não autoriza produção,
pagamentos, cutover, PR, merge ou deploy.

Base remota confirmada: main `910138b98ea67e800e362dbe10f3a4140dacb091`;
segurança `f4c4ddd6c523523dcd6d2981bc5e2c29e9ea6579`; homologação inicial
`7f8fdd25535b4056e906094e4514199cf006d6a5`. A referência local `main` está antiga
(`9096638`); use `origin/main` atualizado nas comparações, sem alterar a main local.

`git merge-base` confirma main → segurança → homologação. `git cherry` não
identificou patches equivalentes já presentes em main. `git merge-tree --write-tree
origin/main HEAD` simulou integração sem conflitos; nenhuma ref main foi movida.

Worktrees preexistentes preservadas: `focustore` tem dois arquivos pyc modificados;
`phase10-recovery` tem `.pytest-tmp-recover-operations/` não rastreado;
`phase6-audit-hardening` tem `.tmp/` não rastreado. As demais estavam limpas antes
desta auditoria. Nenhum desses arquivos foi alterado ou incluído nos commits.

## Achados e correções

1. **Isolamento insuficiente do destino (importante, corrigido).** Host local e
   sufixo `_test` não comprovavam propriedade do banco. O harness aplicava Alembic
   antes da checagem de dados. Agora cria banco com UUID novo, só depois aplica
   migrations/seed, e descarta apenas esse nome se CREATE DATABASE teve sucesso.
   O banco informado serve de conexão administrativa no servidor descartável;
   suas tabelas não recebem migrations ou fixtures. Criar bancos exige CREATEDB.
2. **Seed sem validação própria (importante, corrigido).** Execução isolada podia
   escrever em banco vazio inadequado. A seed exige protocolo, host, porta, nome
   exclusivo desta execução e ausência de query options antes de abrir conexão.
   Dez casos de regressão exercitam rejeições e aceitação da identidade exata.
   Session faz rollback ao sair em exceção; engine é descartado em finally.
   Erros exibem tipo, sem despejar detalhes SQL potencialmente sensíveis.
3. **Cobertura de filtros/recuperação incompleta (corrigido).** A busca anterior
   usava termo comum a todos os produtos. Novas assertions exigem Bottle sem Shirt,
   resultado vazio distinto de indisponibilidade, categoria inexistente vazia e
   recuperação após restart. Uma alteração de estoque SQL (5 → 3 → 5) comprova
   leitura atual do PostgreSQL pela API e pelo HTML, resistindo a catálogo estático
   ou fallback local. A restauração usa finally e somente o banco recém-criado.
4. **Versão instalada sem conferência explícita (corrigido).** A CI compara Next
   instalado com manifesto e lockfile e registra `npm ls` de Next, React e Prisma.

## Revisão arquivo a arquivo

| Arquivo | Avaliação |
|---|---|
| package.json | Next fixado em 16.4.5; comando E2E explícito; sem scripts comerciais novos |
| package-lock.json | Apenas versões Next/env/SWC mudaram; seis entradas extras são dependências opcionais bundled do oxide WASM; demais versões preservadas; integrity presente em artefatos não bundled |
| tests/catalog-postgres-e2e.test.ts | Processos locais reais, SQLite separado, readiness com timeout, HTML sem script/head/style; sete casos E2E; criação/descarte de banco por execução |
| scripts/seed_catalog_e2e.py | Fixtures sintéticas, recusa mistura, transação única, resumo antes do commit, validação própria e dispose |
| scripts/catalog_e2e_database.py | Nome com UUID estritamente validado, sem interpolação arbitrária de identificador; conexão autocommit apenas para CREATE/DROP do banco exclusivo |
| frontend-quality.yml | Node 22, Python 3.13, Postgres 18, instalação reprodutível, Prisma, tipos, contratos/store, fullstack, E2E, build e regressão preservados |
| backend-quality.yml | Postgres descartável, migrations, check, pytest, integridade e OpenAPI; pip check preservado |
| vercel.json | Regra exata da branch, sem wildcard; preservar para evitar preview de novos pushes |
| AUTOMATED_FULLSTACK_HOMOLOGATION.md | Atualizada para banco por execução e sete testes; evidências antigas mantêm identificação de SHA |

## Segurança e arquitetura

Manifesto e lock resolvem Next 16.4.5, React/React DOM 19.3.0 e Prisma/client 6.19.3.
A instalação real é conferida na CI (não existe node_modules nesta worktree).
Build e testes verificam compatibilidade prática. Os advisories oficiais de
03/11/2026 listam 16.4.5 como patch para GHSA-f3mh-rxg3-f5g2, 7qx7-33qx-rqx2,
pc58-hwjq-p385, rhh4-g77r-r9qj, vvgp-ww4w-46vf, vc7v-qv4w-wrv8 e
[mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h).
Isso não é garantia de ausência de vulnerabilidades futuras.

Cliente HTTP usa origem configurada no servidor, credentials omit, no-store,
timeout, validação de contratos e 404 explícito. Service seleciona uma fonte
sem fallback em erro; FastAPI traduz indisponibilidade de armazenamento. Filtros
SQL usam parâmetros e escape de curingas, ordenação estável antes de paginação.
Valores Decimal e promoção zero são preservados pelo mapper/adapter.

IDs internos PostgreSQL são strings na API e public UUIDs são campos separados;
isso não os torna variantes Prisma. Cards e carrinho tratam catálogo FastAPI como
somente leitura; checkout exige UUID de variante Prisma. O checkout Next atual
recusa execução em produção (503). FastAPI exige explicitamente checkout habilitado,
autoridade fastapi e modo cutover para escrita comercial; defaults permanecem
desabilitado/prisma/observe. Nenhuma dessas autoridades foi alterada nesta auditoria.
Reservas usam locks de linha/ordem estável e idempotência; outbox documenta entrega
at-least-once e necessidade de deduplicar event_key. Não houve publisher externo
habilitado, alteração de migrations, sincronização financeira ou pagamento real.

Os tokens Actions têm contents:read; checkout não persiste credenciais. Não há
secrets produtivos referenciados nem pull_request_target. Serviços são descartados
pelo runner, sem volumes persistentes. Dependências e Actions exigem rede externa;
tags de Actions e postgres:18 são móveis (melhoria de pinagem futura).

## CI e limites

Evidência histórica inicial: frontend run 44143957257 e backend 44143962081 em
7f8fdd2, com 48 + 5 + 4 + 48 testes frontend e 206 backend aprovados.
Essa evidência não aprova as correções desta auditoria: ambos os workflows devem
ser disparados e ter head_sha correspondente ao novo HEAD antes de integrá-lo.
Resultados finais e URLs são entregues no relatório da sessão; também podem ser
consultados por workflow_dispatch nesta branch no GitHub.

O E2E usa Next dev e HTTP/HTML, sem navegador, hidratação ou prova visual. Testes
contratuais e Prisma/SQLite não substituem PostgreSQL; a regressão pós-build usa
build de produção separadamente. Não é homologação comercial.

Avisos conhecidos: runtime antigo das Actions forçado pelo runner, punycode,
url.parse, módulo Tailwind e TestClient/httpx. Acesso à API administrativa de hooks
era limitado (404); configurações completas das integrações externas não foram
auditadas administrativamente. Checks/deployments visíveis são consultados antes
do push. Supabase Preview não associa esta branch a um banco.

## Integração recomendada e ressalva operacional

**Preferir A:** integrar a branch E2E completa após revisar o último diff e obter
CI aprovada no SHA final. Inclui o mesmo commit de segurança e torna PR #16
redundante. Vantagens: uma integração e histórico já testado; risco: patch de
segurança aguarda a revisão conjunta.

**Alternativa B:** integrar primeiro PR #16 se a segurança precisar ser entregue
antes. Depois atualizar a comparação com main e integrar somente o restante do
histórico por ancestralidade, sem cherry-pick duplicado. Preservar o SHA de
segurança facilita excluir o commit já integrado; squash/rebase exige comparar
patches novamente. Revalidar a integração após qualquer mudança da base.

**Ressalva importante:** vercel.json não bloqueia main, conforme a
[documentação Vercel](https://vercel.com/docs/project-configuration/git-configuration).
Um futuro merge pode disparar produção automaticamente. Antes de integrar,
o responsável deve aprovar esse deploy ou pausar o auto-deploy de main na
plataforma. Não remover o bloqueio da branch para resolver isso. Nenhuma dessas
operações foi executada nesta sessão.

Reconsultar origin/main e PR #16, simular conflitos novamente e conferir CI no
último SHA imediatamente antes da integração. Pendências futuras: pinagem de
Actions/imagem, atualização das depreciações, E2E de navegador/produção e auditoria
administrativa de integrações. Checkout/pagamentos exigem projeto próprio.
