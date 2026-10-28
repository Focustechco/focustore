# Migração Prisma/FocusStore para PostgreSQL persistente

## Estado desta preparação

O provider do Prisma foi alterado para `postgresql` e a migration inicial foi
gerada em `prisma/migrations/20261028202545_initial_postgresql/migration.sql`.
Ela foi aplicada somente a um cluster PostgreSQL descartável local, na porta
55443, em um schema de teste. Nenhum banco da porta 5432, Neon, Vercel ou
produção foi alterado.

O `prisma/dev.db` permanece preservado no checkout e é um banco local de
desenvolvimento; neste repositório ele está atualmente versionado, apesar da
regra de ignore para novos arquivos `.db`. Ele não deve ser tratado como fonte
dos cadastros da Vercel. Só um backup/exportação autorizado do banco real pode
responder quais usuários, pedidos e produtos existem em produção.

## Variáveis do frontend na Vercel

Adicionar no ambiente correto da Vercel:

```text
DATABASE_URL=postgresql://USER:PASSWORD@EP-...neon.tech/DB?sslmode=require
NEXTAUTH_SECRET=<segredo aleatório com pelo menos 32 bytes>
NEXTAUTH_URL=https://<dominio-canonico>
NEXT_PUBLIC_APP_URL=https://<dominio-canonico>
SOCIAL_LOGIN_ORIGIN=https://<dominio-canonico>
SOCIAL_LOGIN_SECRET=<segredo aleatório com pelo menos 32 bytes>
GOOGLE_CLIENT_ID=<se login Google for ativado>
GOOGLE_CLIENT_SECRET=<se login Google for ativado>
APPLE_CLIENT_ID=<se login Apple for ativado>
APPLE_TEAM_ID=<se login Apple for ativado>
APPLE_KEY_ID=<se login Apple for ativado>
APPLE_PRIVATE_KEY=<conteúdo da chave .p8, se login Apple for ativado>
PAYMENT_GATEWAY_PROVIDER=<provedor configurado; mock não deve ser usado em produção>
```

Para o Prisma do Next.js, `DATABASE_URL` deve ser uma URL `postgresql://` ou
`postgres://`. A URL SQLAlchemy do FastAPI continua separada e usa o formato
`postgresql+psycopg://`; não copiar uma URL para o outro sistema sem revisar.

Depois de criar o banco Neon vazio, a etapa de build/deploy autorizada deve
executar `npx prisma migrate deploy`. Não usar `prisma db push` em produção.

## Transferência de dados

1. Identificar a fonte autoritativa. Não presumir que `prisma/dev.db` contém os
   dados da Vercel; o arquivo é ignorado pelo Git e pode ser apenas fixture local.
2. Congelar ou coordenar escritas no sistema de origem, gerar backup consistente
   e verificar `PRAGMA integrity_check`, foreign keys e contagens. Preservar o
   arquivo original, WAL e SHM quando existirem.
3. Aplicar a migration PostgreSQL em um banco Neon de homologação separado.
4. Importar em ordem de dependência: usuários, contas OAuth, sessões/tokens,
   endereços, categorias, coleções, produtos, imagens, variantes, categorias de
   produto, coleções de produto, estoque/movimentos, carrinhos/favoritos,
   pedidos/itens/histórico, pagamentos/entregas, cupons/usos, banners, reviews,
   auditoria e settings.
5. Inserir os UUIDs e demais IDs originais explicitamente. Preservar hashes
   bcrypt sem recalcular, `providerAccountId`, tokens/expirações quando a
   política de segurança permitir, URLs de imagens e snapshots financeiros dos
   pedidos.
6. Recalcular e comparar contagens por tabela, chaves únicas, FKs, somas de
   pedidos, estoque disponível/reservado, usuários por papel e contas OAuth.
   Conflitos de e-mail/CPF, SKU, slug ou IDs devem virar relatório para revisão;
   nunca resolver com exclusão automática.
7. Repetir a importação em um segundo banco descartável e ensaiar restauração.
   Só depois aprovar a janela de corte e a importação no banco de produção.

A migration cria `TEXT` para IDs Prisma, `TIMESTAMP(3)` para datas, `BOOLEAN`
para flags e foreign keys reais. O SQLite aceitava valores booleanos como
inteiros e armazenava `Float` sem a mesma semântica de PostgreSQL; preços devem
ser reconciliados por centavos antes do corte. O schema não altera `Float` nesta
etapa para preservar o contrato atual do frontend, mas a precisão monetária deve
ser uma decisão explícita antes do gateway real.

## FastAPI/Alembic

O FastAPI atual possui tabelas `categories` e `products` próprias, com IDs
inteiros, e migrations Alembic independentes. O adaptador de catálogo lê o
SQLite Prisma em modo somente leitura; ele não é um dono das tabelas Prisma.

Nesta preparação, Alembic não foi apontado para as tabelas Prisma e nenhuma
migration Python foi alterada. Isso evita que dois ORMs criem ou modifiquem a
mesma tabela. Para uma consolidação posterior, a proposta segura é:

- Prisma ser o dono inicial de usuários, catálogo completo, carrinhos, pedidos,
  autenticação e tabelas Prisma;
- Alembic manter as tabelas legadas em schema próprio, ou migrar explicitamente
  seus dados para tabelas Prisma com mapeamento documentado;
- um único dono de migration por tabela;
- nenhum dual-write informal entre Next.js e FastAPI.

O FastAPI atual não foi alterado nem apontado para o banco Neon nesta etapa.
Após a migração do frontend, `LEGACY_CATALOG_SQLITE_PATH` deixará de ser uma
fonte compartilhada válida; isso exige uma decisão posterior sobre o leitor
PostgreSQL do catálogo e permissões somente leitura.

## Validação e bloqueios

Validado nesta preparação: schema Prisma PostgreSQL, migration inicial aplicada
em banco descartável, geração do Prisma Client 6.19.3, typecheck e build local.

Ainda bloqueado: acesso ao projeto Neon, backup real, inventário do banco da
Vercel, configuração das variáveis na Vercel, importação real, domínio HTTPS,
OAuth real, storage de uploads e publicação. Portanto, a migração não está
concluída e o problema não deve ser declarado resolvido antes dessas etapas.

Não executar seed, `migrate reset`, `db push --force-reset` ou qualquer migration
contra produção sem autorização explícita e backup restaurável validado.
