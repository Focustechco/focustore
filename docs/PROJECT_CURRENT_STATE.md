# Estado atual do FocusStore

Em 24 de novembro de 2026, a revisão local partiu da branch `banco-de-dados` no commit `2f40e6955a37bdd6906447759a8a3639283a5f65`. O histórico informado da integração não está disponível neste clone.

O frontend Next.js usa Prisma com schema SQLite. O backend FastAPI possui catálogo, autenticação e pedidos com PostgreSQL. O catálogo legado é a configuração padrão do backend. A rota de criação de pedidos PostgreSQL depende da seleção do catálogo PostgreSQL e de autenticação e origem confiável. A existência dessa rota exige avaliação antes de qualquer mudança de autoridade comercial.

A seleção de campos da atualização administrativa de cliente foi ajustada para excluir o hash de senha. A regressão HTTP foi adicionada, mas sua execução depende de resolver a incompatibilidade da fixture de integração frontend.

A exclusividade de escrita entre bancos não foi demonstrada. Pagamentos e migração comercial não foram homologados para produção.

Na auditoria da CI, a dependência entre frontend, backend e full-stack foi explicitada no workflow. A homologação remota ainda não ocorreu.
