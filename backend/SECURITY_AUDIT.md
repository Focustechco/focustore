# Auditoria de segurança do backend

## Resumo executivo

Auditoria realizada no backend FastAPI, sem modificar o frontend e sem acessar
o PostgreSQL existente, Supabase ou o SQLite legado.

- Problemas de segurança confirmados: **1**.
- Problemas corrigidos: **1**.
- Problemas críticos ou altos confirmados: **0**.
- Pendências: **3** (ver seção de riscos residuais).
- Correção de schema, migration, seed ou alteração de dados: **nenhuma**.

A auditoria não permite declarar o sistema completamente seguro. A correção
implementada é pontual e cobre injeção de conteúdo em logs por meio do
identificador de correlação HTTP.

## Escopo e metodologia

Foram revisados:

- cadastro, login, logout, cookies e sessões;
- hash de senha e validação de credenciais;
- autorização administrativa e de clientes;
- isolamento de pedidos por usuário;
- schemas Pydantic e limites de entrada;
- consultas SQLAlchemy e SQLite somente leitura;
- cotação do carrinho, estoque e criação idempotente de pedidos;
- CORS, origem confiável, cache, exceções e headers HTTP;
- OpenAPI e dependências declaradas em `requirements.txt`.

As conclusões foram baseadas em leitura do código, testes automatizados
direcionados, compilação Python e verificação do snapshot OpenAPI. Não foram
realizados testes de carga, força bruta, pagamentos, migrations, seeds,
importações ou escritas em bancos.

## Problema confirmado e correção

### SEC-001 — injeção de linhas no log pelo correlation ID

- Severidade: **Baixa**, com impacto em integridade e confiabilidade dos logs.
- Arquivo: `backend/app/main.py`.
- Causa: o valor recebido em `X-Focus-Correlation-ID` era usado diretamente no
  logger e devolvido no response header.
- Impacto: um cliente poderia enviar caracteres de controle, como CR/LF, para
  forjar linhas adicionais ou quebrar a estrutura de registros de diagnóstico.
- Correção: o backend agora aceita somente identificadores de até 128 caracteres
  com conjunto seguro `[A-Za-z0-9._:-]`. Para valores ausentes ou inválidos,
  gera um identificador hexadecimal no servidor.
- Regressão: `test_security_headers_and_log_safe_correlation_id` confirma que
  CR/LF não é devolvido e que o identificador substituto tem formato seguro.

Também foram adicionados headers defensivos para respostas HTTP:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- `Permissions-Policy` restritiva;
- `Strict-Transport-Security` somente quando a requisição usa HTTPS;
- `Cache-Control: no-store` para autenticação, identidade e pedidos.

Esses headers não alteram o contrato JSON nem as rotas do frontend.

## Controles confirmados

### Autenticação e sessão

- Senhas usam Argon2id via `argon2-cffi`.
- Tokens de sessão são aleatórios e somente o hash SHA-256 é persistido.
- Cookies são `HttpOnly`, `SameSite=Lax`, `Path=/` e usam `Secure` conforme
  configuração do ambiente.
- Sessões PostgreSQL têm expiração e revogação verificadas no servidor.
- Tokens com prefixo `pg_` não sofrem fallback para SQLite legado.
- Login usa resposta genérica para credenciais inválidas.
- Cadastro e login possuem rate limit persistido no PostgreSQL.
- Respostas de autenticação não retornam senha ou hash.

### Autorização e isolamento

- Escritas de categorias, produtos e estoque exigem sessão administrativa e
  origem confiável.
- Clientes não podem definir o próprio papel; o modelo PostgreSQL restringe o
  papel a `CUSTOMER`.
- Pedidos PostgreSQL são consultados com filtro simultâneo por `id` e
  `user_id`.
- Pedido de outro usuário resulta em `404`, sem confirmação de existência.
- Criação de pedidos usa o usuário autenticado no servidor.
- Não há endpoint público para alterar status de pedidos.

### Entradas, preços e SQL

- Schemas rejeitam campos extras em autenticação, carrinho e pedidos.
- Quantidades, paginação, preços e IDs possuem limites e tipos explícitos.
- Preços de carrinho e pedidos são consultados no catálogo do servidor.
- Variantes inativas, produtos inativos e estoque insuficiente são rejeitados.
- Idempotência impede duplicação por chave e impede reutilização por outro
  usuário.
- Consultas dinâmicas usam parâmetros; os trechos interpolados encontrados são
  constantes internas de colunas ou placeholders gerados pelo próprio código.
- O SQLite legado é aberto com `mode=ro` e `PRAGMA query_only = ON`.

### Erros, origem e cache

- Detalhes de SQL, credenciais, caminhos e exceções não são enviados ao cliente.
- `Origin` é validado para mutações autenticadas por cookie.
- CORS permite somente a origem explícita configurada.
- Rotas privadas usam `Cache-Control: no-store` e `Vary: Cookie` quando
  apropriado.

## Testes executados

Com o ambiente de testes local e bancos temporários:

- testes de segurança, autenticação, autorização, pedidos e carrinho:
  **40 passed, 1 warning**;
- 2 testes de integração PostgreSQL foram pulados por ausência de
  `TEST_DATABASE_URL` descartável;
- verificação OpenAPI: **PASS**;
- compilação Python dos arquivos alterados: **PASS**;
- `pip-audit`: **não executado**, pois o comando não está instalado no ambiente.

O warning é a depreciação de `httpx` exposta por `starlette.testclient`; não
foi tratado como vulnerabilidade nem houve atualização indiscriminada de
dependências.

## Riscos residuais e pendências

1. A análise de CVEs não foi concluída porque `pip-audit` não está disponível e
   não foi instalado automaticamente. Portanto, não há declaração de que as
   dependências estejam livres de vulnerabilidades conhecidas.
2. Os testes dinâmicos contra PostgreSQL foram pulados por não haver uma URL de
   teste descartável explicitamente fornecida. A integração real deve ser
   validada posteriormente em banco local isolado, sem usar dados existentes.
3. O rate limit atual coordena tentativas por combinação de origem do cliente e
   e-mail. Proteção adicional contra credential stuffing distribuído exige uma
   política de limite por IP confiável/proxy e observabilidade operacional; não
   foi introduzida sem uma decisão de infraestrutura.

## Proteção contra abuso de autenticação

Implementação concluída nesta etapa para cadastro e login:

- O limite por conta usa a identidade de e-mail normalizada e permanece
  independente do endereço de origem. O padrão é **10 tentativas em 15
  minutos**.
- O limite por origem usa somente `request.client.host`, nunca
  `X-Forwarded-For`, `X-Real-IP` ou outro header enviado pelo cliente. O
  padrão é **30 tentativas em 15 minutos**.
- Ambos os limites usam a tabela PostgreSQL existente `auth_rate_limits`, com
  chave hash, janela móvel fixa, `SELECT ... FOR UPDATE` e recuperação
  automática quando a janela expira. Nenhuma migration foi criada ou
  executada.
- O limite retorna HTTP 429 com `Retry-After` em segundos. A mensagem é
  genérica e não revela se o e-mail existe.
- Falhas ao persistir o contador continuam sendo tratadas como indisponibilidade
  do serviço, evitando liberar autenticação quando o controle não pode ser
  aplicado. Senhas, tokens e contadores não são registrados em logs.

Essa solução é adequada para múltiplos processos que compartilham o mesmo
PostgreSQL. Em uma implantação com proxy reverso, o `request.client.host`
precisa representar o proxy confiável ou a origem direta; headers de proxy não
são aceitos automaticamente. Para várias instâncias distribuídas, o PostgreSQL
continua sendo o coordenador, embora uma política dedicada de observabilidade,
limpeza e limites por rede possa ser necessária em escala maior.

Testes de regressão adicionados cobrem: limite por conta contra headers
falsificados, limite por origem entre identificadores diferentes, `Retry-After`,
recuperação após expiração de janela e preservação do login válido. O teste
direcionado de autenticação ficou em **8 passed, 1 warning**.

Também foi adicionado um teste PostgreSQL com duas sessões concorrentes para
confirmar que o bloqueio por linha e o tratamento de corrida na inserção do
contador permitem exatamente uma tentativa dentro do limite. Esse teste não
foi executado nesta sessão porque `TEST_DATABASE_URL` não foi fornecida; o
guard existente o impede de alcançar qualquer banco protegido.

O cadastro ainda preserva o contrato público existente de retornar conflito
para e-mail duplicado (`409`); isso pode permitir enumeração no endpoint de
cadastro e permanece como risco residual compatível a ser tratado somente com
revisão do contrato da interface.

## Checklist para novas funcionalidades

- [ ] Rota classificada como pública, cliente autenticado ou administrativa.
- [ ] Dependência de autenticação/autorização aplicada no endpoint, não apenas
      na interface.
- [ ] Propriedade do recurso filtrada no servidor para toda leitura e mutação.
- [ ] IDs, paginação, quantidades, textos e listas possuem limites Pydantic.
- [ ] `extra="forbid"` usado em payloads de mutação quando compatível.
- [ ] Nenhum preço, desconto, total, papel ou `user_id` confiado ao cliente.
- [ ] Consultas SQL usam parâmetros e não interpolam entrada externa.
- [ ] Transações têm rollback em falhas e testes de concorrência quando necessário.
- [ ] Idempotência definida para operações repetíveis.
- [ ] Logs não incluem senhas, tokens, cookies, URLs com credenciais ou dados
      pessoais; identificadores externos são sanitizados.
- [ ] Erros públicos são genéricos e detalhes técnicos ficam somente nos logs.
- [ ] Cookies têm `HttpOnly`, `SameSite`, `Secure` apropriados e escopo mínimo.
- [ ] Mutação autenticada por cookie valida `Origin`/CSRF.
- [ ] Respostas privadas usam `Cache-Control: no-store`.
- [ ] Headers de segurança e CORS foram revisados.
- [ ] OpenAPI foi comparado e alterações de contrato foram revisadas.
- [ ] Testes de autenticação, autorização, isolamento, validação e rollback foram
      adicionados.
- [ ] Dependências foram verificadas por ferramenta de vulnerabilidades quando
      disponível.
- [ ] Nenhuma migration, seed, escrita real ou alteração de frontend foi feita
      sem autorização explícita.

## Auditoria de dependências — pip-audit

Data da auditoria: **2026-11-09**.

- Python: **3.13.16**.
- pip-audit: **2.10.1**.
- Fonte pública de avisos: serviço padrão do pip-audit/PyPI Advisory Database.
- Arquivo analisado: `backend/requirements.txt`.
- Ambiente analisado: `backend/.venv/Lib/site-packages`.
- Entradas explicitamente fixadas em `requirements.txt`: **30**.
- Registros verificados no arquivo de requirements: **35** (incluindo
  transitivas resolvidas pelo auditor).
- Registros verificados no ambiente runtime: **37**.
- Vulnerabilidades encontradas: **0**.
- CVE/GHSA/PYSEC identificados: **0**.
- Pacotes atualizados: **nenhum**.
- Vulnerabilidades corrigidas por atualização: **nenhuma**.
- Resultado do novo pip-audit: **PASS**, exit code `0` nos dois escopos.

O primeiro comando falhou antes da auditoria porque o cache padrão global do
pip-audit não podia ser criado neste ambiente Windows. A execução foi repetida
com `--cache-dir` apontando para o venv temporário e então concluiu com sucesso.
Esse erro ambiental não foi classificado como vulnerabilidade.

`pip check` também retornou **PASS** (`No broken requirements found`). Não foi
usado `pip-audit --fix` e nenhuma dependência de runtime foi alterada. O venv
temporário usado para a ferramenta ficou fora do repositório.

### Interpretação e limitações

Nenhuma vulnerabilidade conhecida foi identificada nas versões efetivamente
analisadas em **2026-11-09**. Isso não garante ausência de vulnerabilidades
desconhecidas, problemas em bibliotecas nativas do sistema operacional,
dependências não instaladas no ambiente auditado ou vulnerabilidades que ainda
não estejam publicadas na fonte consultada.

Não há arquivo de lock Python, `pyproject.toml`, `requirements-dev.txt`,
`Pipfile.lock` ou `poetry.lock` no backend. O CI instala
`backend/requirements.txt`; por isso esse arquivo e o ambiente instalado foram
os alvos da auditoria. A ferramenta `pip-audit` não foi adicionada ao runtime
nem ao `requirements.txt`.

## Segurança operacional

- Frontend: **não modificado**.
- PostgreSQL existente: **preservado; nenhuma conexão de escrita realizada**.
- SQLite legado: **preservado**.
- Supabase: **não acessado**.
- Migrations: **nenhuma executada**.
- Seeds, resets, importações e pagamentos: **não executados**.
- Commit ou push: **não realizados**.
