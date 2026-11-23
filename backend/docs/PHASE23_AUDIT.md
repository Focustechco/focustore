# Fases 2 e 3 — auditoria e evidências

Base: origin/main `910138b`, com merges 1A `fc12bea` e 1B `a81e7f3`
confirmados. Worktree inicialmente limpa em banco-de-dados; trabalho isolado em
feature/phase-2-3-catalog-inventory. A main já contém catálogo v1, reservas,
movimentações, workers manuais e checkout experimental desativado por padrão.
Evoluir essas estruturas, sem duplicá-las nem ativar fluxos comerciais.

## Auditoria inicial (antes das correções)

| Severidade | Constatação | Consequência / ação |
|---|---|---|
| Alta | Quantidade/TTL aceitam bool/float no serviço interno | Validar tipos inteiros estritos e limites antes da transação |
| Alta | SELECT FOR UPDATE sem refresh de objetos ORM previamente carregados | Reproduzir cache obsoleto e corrigir leituras sob lock |
| Alta | Movimentações protegidas de UPDATE/DELETE, mas não TRUNCATE | Migration incremental com guard de histórico e integridade de estado |
| Alta | Estado e itens da reserva podem ser reescritos sem transição válida | Guards PostgreSQL para estados, identidades, itens e ledger |
| Média | LegacyCatalogRepository não implementa category(slug) do protocolo | GET de categoria legado falha; adicionar consulta ativa parametrizada |
| Média | Filtro PostgreSQL só usa N:N, mapper publica categoria primária como fallback | Alinhar filtro à categoria efetivamente publicada |
| Média | Filtro/ordenação SQLite usa Float bruto, resposta arredonda para centavos | Alinhar leitura à representação monetária sem alterar dados persistidos |
| Média | Cliente aceita public_id arbitrário, estoque negativo/fracionário e metadados de página inválidos | Validar fronteira de leitura e manter IDs internos/públicos separados |
| Média | Dinheiro convertido diretamente em Number | Acrescentar centavos inteiros e arredondamento decimal explícito, preservando campos de apresentação |
| Baixa | Contrato não informa versão aditiva/origem real da fonte FastAPI | Metadados compatíveis e sem inferir correspondência entre bancos |

O checkout Prisma já realiza suas próprias operações comerciais; não será
modificado. O checkout FastAPI existente depende de flags de cutover, autoridade,
debug e simulador, todas desativadas por padrão. Nenhuma flag será ativada,
nenhuma rota de reserva será criada, nenhum estoque Prisma será sincronizado.
Correspondência verificada de identidade não confere autoridade de venda.

## Plano de validação

Regressões antes das correções; PostgreSQL descartável com destino confirmado
por SQL; suíte completa backend/frontend/fullstack, TypeScript, Alembic
upgrade/check, agentes de integridade e OpenAPI, dependências e diff. Segunda
passagem de auditoria sobre o resultado e testes adicionais para defeitos.
Resultados, limites e custos medidos serão registrados após a execução; não há
alegação antecipada de segurança perfeita ou desempenho de produção.

## Decisões e contrato de leitura

`/api/v1/catalog` continua v1; envelopes adicionam `contract_version=1.1`, e
produtos adicionam `currency=BRL` e `catalog_origin`. `id` não muda; `public_id`
é o UUID real do PostgreSQL quando a origem é PostgreSQL, e continua opcional
na origem Prisma legada. O adaptador preserva ambos e marca todo produto lido
via FastAPI como `catalogSource=fastapi`, mesmo quando o backend lê SQLite.
Isso não confere permissão de compra ou equivalência com um ID Prisma.

Moeda é normalizada somente na leitura com Decimal, escala 2, HALF_UP e limite
Numeric(10,2). Filtros SQLite usam o mesmo valor publicado (cast textual da
fonte Float, normalização decimal, comparação em centavos); não há UPDATE de
preço persistido. O adaptador usa BigInt para arredondamento e expõe campos
aditivos `basePriceMinor`, `priceMinor` e promoções em centavos. Os antigos
Number continuam exclusivamente para apresentação e compatibilidade; checkout
Prisma não recebe esses valores como preço autorizado pelo servidor.

Produtos inativos, categorias inativas e variantes inativas seguem filtrados.
Paginação, pesquisa literal parametrizada, ordenação determinística e erros
explícitos continuam. Filtro por categoria primária PostgreSQL corresponde ao
fallback publicado quando não há vínculo N:N. A origem é selecionada por
CATALOG_READ_SOURCE/CATALOG_SOURCE; falha não troca de fonte. Coleções, reviews
e metadados de destaque continuam capacidades Prisma explicitamente separadas,
sem simular suporte equivalente no PostgreSQL.

## Regras transacionais e idempotência

Evoluímos Inventory/StockReservation/StockReservationItem/InventoryMovement já
existentes. Disponível é livre para alocação; reservado inclui reservas pendentes
e valores legados sem atribuição. Físico = disponível + reservado. Reservar move
disponível para reservado, confirmar consome reservado/físico, liberar/expirar
move reservado para disponível. Não há sincronização com estoque Prisma.

`unattributed_reserved` preserva o reservado anterior que não corresponde a
itens pendentes conhecidos. No upgrade é calculado como reservado menos a soma
dos itens pendentes; inconsistência negativa aborta a migration. Não se inventa
uma reserva legada. Novos saldos iniciais têm o mesmo tratamento explícito pelo
trigger; o baseline é imutável após criação. O banco exige no commit:

`quantity_reserved = unattributed_reserved + SUM(itens de reservas pending)`.

As quantidades existentes não mudam. Constraints mantêm saldos não negativos,
quantidades de itens/movimentos positivas, unicidade por operação e no máximo
uma operação terminal por reserva/variante. Triggers diferidos exigem item,
movimento reserve e movimento terminal compatíveis em quantidade, variante e
inventário, na mesma transação. Estado e identidade não podem ser reescritos
arbitrariamente; histórico/itens não admitem edição, DELETE ou TRUNCATE.
Saldos disponíveis de ajustes administrativos não são uma nova API de ajuste
auditável nesta fase; o contrato implementado é o das reservas. Papéis capazes
de DDL/desabilitar triggers continuam fora da garantia.

Estados: pending → confirmed/released/expired. Repetir o mesmo terminal é no-op;
outro terminal é conflito. TTL padrão 900s, inteiro de 1 a 86400s, avaliado pelo
relógio PostgreSQL. Criação inicia o TTL após os locks, e confirmação avalia o
prazo depois de esperar todos os locks de saldo. Expiração usa estado/prazo
persistidos; o worker manual já existente recupera pendências após reinício.
Nenhum scheduler, broker, Redis ou endpoint de reserva foi introduzido.

Chaves persistem em `(scope,key)` sem expiração automática: retenção acompanha
todo o histórico, e os guards impedem apagamento silencioso. Payload canônico
inclui UUID/quantidade ordenados e TTL, com SHA-256. Mesma chave/payload retorna
a identidade original e o estado atual persistido, inclusive terminal; outro
payload gera conflito. Metadados de origem não alteram o conteúdo da operação.
Falha antes do commit desfaz chave, saldos, itens e movimentos; reenvio recupera
com a mesma chave. Não há registro "incompleto" confirmado fora da transação.

READ COMMITTED e locks PostgreSQL: reserva antes dos saldos; variantes/saldos
em ordem crescente de PK interna. Leituras sob lock usam populate_existing,
impedindo lost update a partir de cache ORM. Guards de contador também bloqueiam
o saldo antes de reconciliar. As operações que possuem a própria transação
repetem apenas SQLSTATE 40P01/40001 após rollback, até 3 tentativas com pequeno
backoff. Outros erros, inclusive falha de movimento, não são ocultados. Métodos
`*_in_transaction` não fazem retry/commit por conta própria: o chamador deve
repetir a unidade completa se necessário. Não executar efeitos externos dentro
de uma unidade sujeita a retry.

Prisma continua a única autoridade comercial ativa. Correspondência de IDs não
é transferência de estoque. As flags existentes de checkout experimental e
cutover não foram habilitadas; habilitá-las em múltiplos sistemas não é suportado
por esta entrega e exige uma decisão operacional posterior de autoridade única.

## Migration e recuperação

`f7c8d9e0f1a2` segue `f6b7c8d9e0f1`, adiciona baseline, índice terminal e guards.
Não altera PKs/FKs, pedidos ou schema Prisma. O backfill do baseline atualiza
apenas a coluna nova; locks DDL e o UPDATE podem bloquear saldos. Dimensionar
volume e janela antes de qualquer implantação persistente, que não foi feita.
Duplicidade terminal ou contador legado inconsistente interrompem upgrade em
vez de apagar/reparar dados silenciosamente. PostgreSQL mantém DDL transacional.

Teste injeta falha após DDL/backfill, confirma rollback de coluna/revisão, e
repete upgrade preservando saldo disponível 4/reservado 2 e estoque legado 9.
Repetir upgrade head após sucesso não reaplica operações. Downgrade só é
permitido sem reservas; com histórico ele recusa remover as proteções. O
downgrade nunca é um mecanismo de compensação ou exclusão de eventos.

## Segunda passagem de auditoria

- Correção: regressões reproduziram três falhas de catálogo e cinco falhas de
  validação/cache/histórico antes das correções; uma revisão posterior adicionou
  a corrida de TTL durante espera por lock. Testes de concorrência usam conexões
  PostgreSQL reais, com 2 e 10 solicitantes, e saldos/movimentos conferidos em SQL.
- Segurança: parâmetros SQL permanecem vinculados; interpolação em IN contém
  apenas quantidade de placeholders. Erros HTTP não ecoam corpo privado upstream.
  UUIDs e contadores são validados; nenhuma credencial viaja no fetch de catálogo.
  Não há novas rotas de escrita nem alteração do checkout Prisma. Testes de
  autorização, CSRF, sessão, upload e bloqueio comercial preexistentes são mantidos.
- Dependências: npm audit detectou Next.js e effect transitivo. Atualizamos o
  patch Next.js 16.4.1→16.4.6 e o override de effect no Prisma Config para ^3.22.1;
  npm audit retornou zero advisories. Sem migração major Prisma/Next/React.
- Desempenho: o legado fazia 2+3N SELECTs por página; agora são 5 SELECTs,
  medidos por trace para 10 produtos. PostgreSQL mantém eager loading existente;
  locks de reserva têm custo proporcional às linhas (máximo 100). Checks diferidos
  repetem consultas de ledger por evento e podem custar quadraticamente em lotes
  grandes: não há benchmark de throughput/SLA de produção. Medir contenção e
  volume antes de ampliar uso; não alegamos adequação universal de desempenho.
- Arquitetura: leitura monetária centralizada, carregamento de relações em lote,
  variante adaptada em função tipada separada, transações/retry reutilizados,
  nenhuma infraestrutura distribuída nova. A auditoria foi uma segunda passagem
  técnica com testes e inspeção, não uma certificação externa independente.

## Ambiente e evidências

Destino PostgreSQL confirmado por SELECT current_database/current_user,
inet_server_addr/port e data_directory antes das escritas: phase23_test,
focusstore, 127.0.0.1:55446, `.tmp/phase23-pg`. Migrations/testes destrutivos só
nesse cluster e em SQLite de fixtures. Nenhuma escrita em banco persistente.

Comandos de validação: pytest -q -ra --tb=short; npm test; npm run test:fullstack;
npm run typecheck; alembic upgrade head; alembic check; python -m
app.agents.integrity; python -m app.agents.openapi_check; python -m pip check;
npm audit; git diff --check. Resultados finais e CI constam no PR/relatório.

Limitações de ambiente observadas: cache uv com ACL incompatível (instalação
sem cache); tsx não consulta usuário no sandbox (testes Node elevados); Turbopack
encontrou diretório pytest inacessível dentro da árvore do projeto. Removemos
os temporários antigos e movemos pytest para TEMP, sem mudar autorização ou
desabilitar cenários. O teste de página agora inclui o log do servidor na falha.

O fullstack também reproduziu uma corrida Windows no encerramento: taskkill
falhou entre a leitura do exitCode e o reinício. O harness só tolera a falha
quando observa efetivamente o evento exit; caso contrário continua falhando.
O teste completo de reinício/persistência passou depois. `.tmp` e
`.local-validation` passaram a ser ignorados para não entrarem nos commits nem
na descoberta automática de fontes do frontend. Nenhuma falha foi convertida
em skip ou remoção de assert de segurança.

## Resultado final local (23/11/2026)

| Verificação | Resultado |
|---|---|
| pytest completo, código final | 227 passed, 0 skipped; 1 warning Starlette/httpx; 340,47s locais |
| npm test | 51 passed, 0 skipped; 121,21s locais |
| npm run test:fullstack após correção do harness | 5 passed, 0 skipped; 70,37s locais |
| npm run typecheck | exit 0 |
| alembic upgrade head e check | aprovados, nenhum drift de metadata |
| Integridade PostgreSQL / OpenAPI | aprovados |
| python -m pip check | No broken requirements found |
| npm audit | 0 advisories |
| git diff --check | aprovado |

Tempos refletem esta máquina Windows com Node 24/Python 3.13, sob carga de
compilação e com particularidades de ACL; não são benchmark de produção.
CI Ubuntu/Node 22 será acompanhada separadamente no PR. O agente de integridade
preexistente verifica categorias/revisão; invariantes de reserva são comprovadas
pelos testes e pelos triggers/constraints específicos, não por esse agente.

Arquivos comerciais Prisma (checkout, pagamentos, inventário, autenticação e
schema) e o checkout experimental FastAPI não apresentam diff. As mudanças de
testes/store e tests/fullstack são diagnóstico e encerramento de processos,
não alterações das regras comerciais. O restante do diff é catálogo, estoque
PostgreSQL, migration, documentação, regressões e patches direcionados npm.
