# Dívida técnica

- P0. Validar a correção da exposição de hash na atualização administrativa com teste HTTP e banco descartável. A seleção explícita está implementada.
- P1. A criação de pedidos PostgreSQL usa a seleção de catálogo como gate. Avaliar autorização e exclusividade de escrita antes de ativar a fonte PostgreSQL.
- P1. Recuperar o histórico da branch de integração e comparar as correções e o protocolo de autoridade.
- P1. Conciliar o banco e a porta solicitados para testes PostgreSQL com os bloqueios explícitos do guard, sem reduzir as proteções.
- P1. A fixture de integração frontend exige schema Prisma PostgreSQL, mas o schema atual declara SQLite. Preparar uma estratégia de testes isolada e compatível.
- P2. Diagnosticar a chamada nativa de identidade no sandbox Windows. Node e tsx funcionaram fora dele.
- P2. Investigar e atualizar com segurança a versão Next.js sinalizada pelo build por vulnerabilidade conhecida, preservando o lockfile até revisão.

Atualização da CI: as fixtures frontend passaram a criar SQLite temporário, porém as suítes de integração e full-stack ainda falharam localmente. O workflow PostgreSQL usa banco descartável compatível com o guard. A execução remota permanece pendente.
