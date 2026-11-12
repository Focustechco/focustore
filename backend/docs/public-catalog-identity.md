# Fase 1A — identidade pública do catálogo

Produtos e variantes passam a ter `public_id` UUID v4 obrigatório e único em
cada tabela. O tipo SQLAlchemy `Uuid(as_uuid=True)` compila para UUID nativo no
PostgreSQL. PKs inteiras, FKs, URLs por ID e relacionamentos continuam iguais.
Não existe correspondência com os IDs Prisma, nem promessa de unicidade entre
tabelas diferentes: consumidores devem manter o tipo da entidade.

## Geração e imutabilidade

A geração ocorre na aplicação, com `uuid.uuid4` como default SQLAlchemy em ambos
os modelos. Isso mantém o mesmo comportamento dos testes SQLite e dos inserts
ORM/Core, sem extensão PostgreSQL ou dependência de versão de `gen_random_uuid`.
A migration utiliza o mesmo gerador no backfill. O UUID é atribuído no INSERT
(flush), não necessariamente na construção do objeto Python.

Não há default SQL no servidor: inserts SQL diretos devem fornecer um UUID v4;
omitir o campo falha por NOT NULL. Novos escritores e importadores devem usar
os modelos ou fornecer UUIDs explicitamente. A alternativa de geração no banco
centralizaria também inserts SQL, mas exigiria um default específico por dialeto;
reavaliar essa opção antes de introduzir escritores independentes na Fase 1B.

Os contratos de criação/alteração de produto não aceitam `public_id`. Triggers
BEFORE UPDATE nas duas tabelas rejeitam mudanças, inclusive ORM, SQL Core e SQL
direto. Atualizar outros campos ou atribuir o mesmo UUID continua permitido.
Usuários administrativos capazes de desabilitar triggers estão fora dessa
garantia. `metadata.create_all()` não instala triggers: ambientes PostgreSQL
devem ser criados por Alembic.

## Migration e recuperação

Revision `d1e2f3a4b5c6`, após `a7b8c9d0e1f2`:

1. Adiciona colunas nullable sem alterar dados ou chaves existentes.
2. Preenche apenas valores ausentes, em lotes de até 1.000 registros.
3. Impõe NOT NULL, UNIQUE e instala triggers de imutabilidade.

Os lotes limitam memória; a migration inteira permanece em uma transação
PostgreSQL. Uma falha faz rollback de dados, DDL e revisão Alembic. Verificar
logs, revisão e esquema, corrigir a causa e repetir `alembic upgrade head`.
Não fazer `stamp` para contornar uma falha. UUIDs de uma transação abortada
podem ser gerados novamente porque nunca foram publicados.

O backfill percorre a PK inteira em ordem, usando o último ID de cada lote como
limite inferior do próximo. Isso evita reler o prefixo já preenchido a cada
consulta. IDs negativos e lacunas são suportados. Os lotes não fazem commits
intermediários: o lock ACCESS EXCLUSIVE obtido pelo ALTER TABLE permanece até
o commit e pode bloquear inclusive leituras. A atomicidade não torna a execução
online; uma implantação futura exige janela de manutenção, medição prévia e
limites de espera/duração configurados pela operação.

Repetir `alembic upgrade head` após sucesso é um no-op pelo controle de revisão,
preservando UUIDs. A função `upgrade()` isolada não é idempotente e não deve ser
executada diretamente, nem reaplicada após manipulação de `alembic_version`.

Antes de qualquer execução, conferir host, porta, nome e caminho do cluster:

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port(),
       current_setting('data_directory');
```

Nesta fase executar somente em cluster descartável, sem carregar `.env` de
produção: definir DATABASE_URL e TEST_DATABASE_URL explicitamente. Os testes
PostgreSQL exigem loopback e nome terminado em `_test` e isolam cada caso em um
schema aleatório. Isso é uma barreira adicional; o operador ainda deve confirmar
que o cluster é descartável. Não há autorização para migrar bancos persistentes.

O upgrade não remove registros. A adição de colunas, backfill e índice UNIQUE
podem bloquear escritas e gerar WAL; medir duração/volume antes de uma futura
implantação. A estratégia atual privilegia atomicidade em catálogos pequenos.
O downgrade remove as identidades públicas e seus guards: é destrutivo para
esse novo campo e só deve ser usado em testes descartáveis. Após publicação de
UUIDs, recuperar por correção progressiva ou restauração controlada de backup,
preservando os UUIDs já divulgados; não fazer downgrade como rollback operacional.

## Contrato compatível e limites

As respostas de produto incluem `public_id` sem substituir `id` inteiro. O mapper
do catálogo PostgreSQL mantém `id` string e inclui UUID em produtos e variantes.
No contrato compartilhado de catálogo o campo é opcional/null: o catálogo Prisma
não recebe um UUID PostgreSQL inventado. Seleção da fonte e rotas não mudam.
OpenAPI é atualizado de forma aditiva. Clientes que rejeitam propriedades
desconhecidas devem ser verificados antes da implantação.

Esta fase não cria endpoints nem ativa operações de compra FastAPI. Endpoints
de gestão que já existem na main são preservados; sua presença não muda o papel
operacional de leitura do FastAPI. Prisma mantém checkout, autenticação, carrinho,
pedidos e pagamentos. Não há migração de usuários, reserva de estoque ou tabela
de correspondência entre sistemas.

## Fase 1B

Definir como consumidores resolverão produtos/variantes por UUID e a política
de correspondência com o catálogo legado, sem deduzir equivalência de IDs.
Inventariar escritores/importadores, avaliar default no banco se necessário e
medir a migration em uma cópia descartável representativa. Só então planejar
exposição e adoção gradual do novo identificador pelos consumidores; manter os
IDs antigos enquanto houver clientes dependentes deles.

## Validação local em 12/11/2026

Branch `feature/phase-1a-public-identity`, criada de `origin/main` em `4dd45ca`
após fetch. A worktree original estava limpa em `banco-de-dados`; nenhum commit
foi feito nessa branch. Os commits locais de identidade já existentes foram
reaproveitados por cherry-pick e complementados com testes e documentação.

Destino confirmado por consulta SQL antes do primeiro upgrade: PostgreSQL 18.6,
`phase1a_test`, usuário `focusstore`, loopback porta 55443, data directory
`.tmp/phase1a-pg` desta worktree. Nenhum banco persistente foi migrado.

Validações: 131 testes passaram na suíte backend completa, com um aviso de
depreciação e TEST_DATABASE_URL explícita; testes de
geração para ambos os modelos, unicidade por tabela, UUID nativo/NOT NULL,
estabilidade após commit/reabertura/atualização, bloqueio de mudanças ORM/Core,
backfill legado e tabela vazia, compatibilidade de endpoints e OpenAPI.
Falha injetada após backfill confirma rollback de DDL, dados e revisão, seguido
de upgrade bem sucedido. `alembic upgrade head`, `alembic check`, agente de
integridade, snapshot OpenAPI e `pip check` passaram.

Usar `--basetemp=../.tmp/<nome-exclusivo>` no pytest deste ambiente evita erros
de acesso ao diretório temporário padrão do sandbox. Há aviso de depreciação
Starlette/httpx pré-existente; dependências não foram alteradas nesta fase.

## Revisão para publicação

A feature foi rebaseada sobre `origin/main` em `9eb70a1`, preservando o conteúdo
dos quatro commits iniciais. A revisão corrigiu o percurso repetido do backfill
por paginação pela PK, sem alterar geração de UUID ou arquitetura. Testes
adicionais cobrem 2.005 registros por tabela com preservação de todas as colunas
anteriores, reaplicação do upgrade, SQL direto com/sem UUID e atualização que
mantém a identidade. A suíte passou com 134 testes e um aviso de depreciação.
Upgrade Alembic, check de modelos, integridade PostgreSQL, OpenAPI e pip check
foram repetidos no cluster descartável `review1a_test`, loopback porta 55444,
data directory `.tmp/review1a-pg`, confirmado por SQL antes do primeiro upgrade.

Não há dependência de pgcrypto ou uuid-ossp: UUIDs são gerados pelo Python;
triggers usam PL/pgSQL disponível na instalação padrão. Não foi introduzido
novo escritor nem contrato de escrita. O agente de integridade atual verifica
categorias e revisão Alembic; as garantias de identidade de produtos e variantes
são verificadas pelos testes PostgreSQL específicos, não por esse agente.
