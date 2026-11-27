# Controlador PostgreSQL descartável — preparação

O módulo `backend/scripts/docker_postgres_adapter.py` prepara um ciclo de smoke test com verificações de contexto, imagem, container e identidade. O comando dedicado opera em planejamento por padrão e exige `--execute --confirm-disposable` para iniciar operações. As variáveis de ambiente, por si só, não autorizam o ciclo. A guarda das fixtures PostgreSQL e o bloqueio anterior da CI permanecem ativos. Não foi executado um smoke test real nesta fase.

Cada plano gera UUID, nome, labels e duas credenciais aleatórias separadas. O plano de argumentos não contém as credenciais. A proposta para bootstrap envia a senha administrativa por stdin, sem TTY, a um processo inicial no container. Esse processo cria arquivo em `/var/lib/postgresql`, previsto como tmpfs, com modo `0600` e propriedade `postgres:postgres`, e passa apenas o caminho por `POSTGRES_PASSWORD_FILE` ao entrypoint oficial. A credencial da aplicação não é enviada nem é criada uma role nesta fase.

O diretório proposto cobre o volume declarado pela imagem PostgreSQL 18 e seu layout versionado. A presença de mounts persistentes, bind mounts, socket Docker, namespaces do host, privilégios adicionais, configurações de rede ou portas inesperadas causa rejeição. A verificação da porta livre é pontual e não elimina a corrida até a publicação. A opção `--pull never` impede download automático na criação.

As validações de `docker inspect`, a normalização de digest e arquitetura, as opções efetivamente retornadas pelo Docker Desktop, o entrypoint e a disponibilidade de utilitários no container ainda não foram verificadas em execução real. O código planeja verificar o arquivo `0600`, seu dono, ausência de symlink e tmpfs após readiness e autenticação, antes de removê-lo. A role de aplicação não é criada. O controlador compara `pg_control_system()` dentro do container e por TCP no loopback, mas essa sequência só foi exercitada com mocks. A senha pode ficar acessível a processos privilegiados dentro do container, no ambiente do processo `psql` e ao administrador Docker, que integra a fronteira de confiança.

## Primeiro smoke test proposto, sujeito a autorização posterior

1. Revisar o código e confirmar o contexto local, o digest, a porta livre e a ausência de volumes persistentes. Capturar o ID completo da imagem e validar que a arquitetura corresponde ao engine.
2. Mediante autorização, executar o comando dedicado para criar um único container com labels, UUID e token próprios, validar o ID completo e o estado criado e iniciar sem TTY, fornecendo a credencial por stdin. O controlador valida novamente a configuração, o estado e a publicação em loopback.
3. Antes de qualquer uso de banco, obter e registrar de maneira independente o identificador retornado por `pg_control_system()`, comparar em novas conexões e confirmar o diretório de dados e o armazenamento efêmero. Confirmar permissões do arquivo de senha sem imprimir seu conteúdo.
4. Sem migrations, conferir somente readiness e identidade. Encerrar e remover apenas o container cujo ID, labels e imagem forem reconfirmados. Investigar qualquer mount inesperado antes de prosseguir.

O comando operacional posterior, a executar apenas após autorização específica, é:

```powershell
Set-Location 'C:\Users\marxa\Documents\focus\FocusStore\focustore.worktrees\postgres-consolidation-marxa\backend'
& .\.venv\Scripts\python.exe .\scripts\smoke_docker_postgres.py --execute --confirm-disposable
```

Sem os dois argumentos, o comando não executa o ciclo. Em falha ou identidade incerta, o container é preservado para investigação. Os testes simulados não comprovam que a configuração planejada funciona no Docker ou que o armazenamento real é descartável.

## Diagnóstico da tentativa operacional

O relatório original sem ID e sem etapa não permite identificar se a criação foi tentada nem provar ausência de recurso. O corte `command[3:]` remove o executável e o contexto já adicionados por `_command`; o primeiro argumento resultante é `create`. Essa composição tem regressão simulada. A causa da tentativa anterior permanece desconhecida sem o código de saída ou diagnóstico original.

O relatório de falha agora informa etapa, código sanitizado, ID registrado, UUID da execução, código de saída quando disponível, estado conhecido do recurso e situação da limpeza. `creation_outcome_unknown` significa que uma criação foi tentada e seu resultado não foi confirmado. Não equivale a demonstrar que nenhum container foi criado. Nenhum stdout, stderr, senha ou token de propriedade é incluído.

O readiness usa TCP loopback dentro do container e um prazo compartilhado entre inspeções, comandos e espera. O teste completo de identidade também exige autenticação por TCP e reconfirmação antes de encerrar. A sequência `start` seguida de `attach`, a abertura e encerramento do stdin, o comportamento do servidor temporário do entrypoint e as representações efetivas de tmpfs ainda requerem observação operacional. O limite de readiness não inclui a criação do processo attach nem garante limite para a escrita de stdin. Uma execução com incerteza preserva o recurso.

## Atualização após a quarta tentativa — informação operacional reportada

O resultado fornecido pelo operador informa `status: passed` e `container_removed: true`, seguido da inspeção de recursos. Esta atualização substitui, para essa execução, as afirmações anteriores de que o ciclo só tinha sido simulado. O resultado foi informado pelo usuário; não foi repetido nesta fase. A causa específica da incompatibilidade original de permissões não foi comprovada.

O fluxo exige, em sequência, verificação do container, readiness TCP, autenticação e comparação interna/externa de identidade, verificação efetiva do tmpfs, remoção do arquivo de bootstrap e, após nova verificação de identidade, parada e remoção do container. O teste de readiness isoladamente não autentica. O envio por pipe é não bloqueante; a criação do processo `Popen` continua sem prazo máximo garantido. Isso deve ser considerado antes de nova execução operacional.

O primeiro container residual foi informado como removido. `scripts/recover_disposable_containers.ps1` seleciona exclusivamente o segundo ID autorizado, verifica por padrão e exige `-Remove -Confirm` para a remoção, com nova verificação logo antes da operação. O token original não está disponível; a intervenção é manual e não equivale à limpeza automática com token. Não foi executada nesta fase.

```powershell
.\scripts\recover_disposable_containers.ps1
# Somente após autorização específica:
.\scripts\recover_disposable_containers.ps1 -Remove -Confirm
```

O usuário informou que o PostgreSQL local escuta em todas as interfaces; essa configuração não foi inspecionada ou modificada nesta fase.
