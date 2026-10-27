# Login social Google e Apple

## Estado da entrega

Código implementado na `main`, usando as tabelas existentes `users`, `accounts`,
`sessions` e `verification_tokens`. Não há alteração de schema, migrations,
IDs antigos, hashes de senha, papéis ou outro banco.

Os únicos trechos alterados no modal são os dois `onClick` autorizados. Botões,
ícones, textos, classes, layout, formulário e animações foram preservados.
Os eventos usam o aviso e estado de carregamento já existentes, bloqueiam novos
cliques e navegam para o provedor quando o servidor autoriza o início.

**Ainda não operacional com os provedores reais.** Na inspeção inicial não havia
origem/segredo do fluxo nem credenciais Google/Apple configurados. Os testes usam
provedores simulados e JWTs assinados, não login fictício em produção. Nenhum
recurso Google Cloud, Apple Developer ou Vercel foi alterado.

## Biblioteca e fluxo

- `openid-client` 6: discovery oficial, Authorization Code Flow, troca de código,
  validações OIDC e JWKS. `enableNonRepudiationChecks` habilita explicitamente a
  verificação JWS da assinatura do ID token, além de issuer/audience/nonce/exp.
- `jose` 6: cookie temporário cifrado com JWE e assinatura ES256 do client secret
  Apple. Não é outro sistema de sessão nem um adaptador NextAuth.
- Provedores/issuers são fixos: Google e Apple. Não há issuer ou URL de token
  configurável pelo navegador.

1. O botão faz POST same-origin para `/api/auth/social/{provider}/start`.
2. O servidor valida configuração, origem e limite local de tentativas. Gera
   state, nonce, verifier PKCE e prova de transação criptograficamente aleatórios.
3. O fluxo fica em cookie HttpOnly cifrado, limitado a dez minutos, e a prova
   fica como hash em verification_tokens. Não se guarda senha nesse cookie.
4. Google usa PKCE S256. Apple usa nonce/state e autenticação confidencial por
   client secret; PKCE só é enviado se a discovery anunciar suporte. A discovery
   Apple consultada não o anuncia.
5. O callback exige cookie válido, provider/origin/state corretos e consome a
   prova no banco uma única vez. Replay e transações expiradas são rejeitados.
6. OIDC troca o código no servidor e valida o ID token e sua assinatura RS256.
7. Uma transação Prisma obtém/cria o vínculo e cria uma sessão FocusStore.
   Access token, refresh token e ID token não são persistidos: não são necessários
   para o login da loja.
8. O servidor define o cookie `focus_session`, com token aleatório de 32 bytes,
   validade de um dia e mesmo formato/tabela usados pelo login tradicional.
9. Retorna à rota local de origem com 303. O header existente consulta
   `/api/auth/session` ao montar e passa a reconhecer o usuário.

Os cookies temporários são separados por provider e limitados ao caminho OAuth.
Apple usa SameSite=None/Secure para receber o callback cross-site POST; Google
usa Lax. A sessão definitiva usa Lax, HttpOnly e Secure quando a origem é HTTPS.
Produção exige HTTPS. Não há fallback para segredo aleatório de servidor.

## Configuração de servidor

| Variável | Finalidade |
| --- | --- |
| SOCIAL_LOGIN_ORIGIN | Origem canônica exata, sem path/query/fragmento, por exemplo http://localhost:3000 em desenvolvimento Google |
| SOCIAL_LOGIN_SECRET | Segredo aleatório de pelo menos 32 bytes, estável entre instâncias. Na ausência, usa NEXTAUTH_SECRET se válido |
| GOOGLE_CLIENT_ID | Client ID de aplicação web Google |
| GOOGLE_CLIENT_SECRET | Client Secret Google |
| APPLE_CLIENT_ID | Services ID web Apple, não o Bundle ID nativo |
| APPLE_TEAM_ID | Team ID Apple |
| APPLE_KEY_ID | ID da chave Sign in with Apple |
| APPLE_PRIVATE_KEY | Conteúdo da chave .p8 PKCS#8, com quebras reais ou sequências literais \n |

Nenhuma dessas variáveis deve usar prefixo NEXT_PUBLIC_. O arquivo `.env.example`
contém somente campos vazios/comentários, sem credenciais inventadas. Use um
segredo novo, não valores demonstrativos ou expostos no histórico.

O client secret Apple é um JWT ES256 gerado no servidor, com kid, iss=Team ID,
sub=Services ID, aud=https://appleid.apple.com e validade de cinco minutos.
Configurações OIDC são reutilizadas por até quatro minutos; reiniciar instâncias
após trocar credenciais/chaves. Não registrar chaves, JWTs ou cookies em logs.

## URLs dos callbacks

O código calcula exatamente:

```text
${SOCIAL_LOGIN_ORIGIN}/api/auth/social/google/callback
${SOCIAL_LOGIN_ORIGIN}/api/auth/social/apple/callback
```

Google local, com SOCIAL_LOGIN_ORIGIN=http://localhost:3000:

```text
http://localhost:3000/api/auth/social/google/callback
```

Para Apple é obrigatório um domínio HTTPS registrado. Exemplo **ilustrativo**, a
substituir pelo domínio real autorizado:

```text
https://loja.example.com/api/auth/social/google/callback
https://loja.example.com/api/auth/social/apple/callback
```

Não há domínio de produção confirmado nesta tarefa; não inventar uma URL Vercel.
A URL cadastrada nos provedores precisa corresponder à origem configurada e ao
path acima, inclusive protocolo, host e porta. O callback Google aceita GET; o
Apple recebe POST application/x-www-form-urlencoded.

## Google Cloud

1. Selecionar/criar projeto e configurar consentimento/branding, audiência e
   usuários de teste quando o aplicativo estiver em modo de teste.
2. Criar um cliente OAuth do tipo aplicação web. Registrar a origem da loja e o
   callback Google exato acima para cada ambiente autorizado.
3. Definir GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SOCIAL_LOGIN_ORIGIN e segredo
   do fluxo no servidor. Escopos usados: openid, email, profile.
4. Testar redirecionamento, consentimento, retorno e sessão com uma conta de teste.
   Cumprir verificações/publicação exigidas pelo Google antes de abrir ao público.

[Referência oficial Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).

## Apple Developer

1. Ter acesso ao programa Apple Developer e habilitar Sign in with Apple no App
   ID principal apropriado.
2. Criar/configurar um Services ID para a autenticação web, associado ao App ID.
   Configurar os domínios e Return URLs HTTPS necessários no portal.
3. Criar uma chave habilitada para Sign in with Apple e proteger a chave .p8.
   Configurar Services ID, Team ID, Key ID e chave somente no servidor.
4. Usar um domínio HTTPS autorizado para o teste web; localhost e IP não são
   Return URLs válidas Apple. Um ambiente local precisa de domínio/túnel HTTPS
   aprovado e configurado nos provedores; nada disso foi provisionado aqui.
5. Testar primeiro consentimento e retorno subsequente, inclusive Hide My Email.
   O código usa o sub estável por provider, não e-mail, para contas vinculadas.

Apple pode não repetir e-mail/dados de perfil em acessos posteriores: um vínculo
existente funciona apenas com o sub validado. Para criar uma conta nova exige-se
e-mail verificado; aceita-se o relay privado Apple. O campo user não assinado do
POST não é usado para autenticar, associar ou alterar o nome. Nome pode ser null.
Transferências de aplicativo/equipe que alterem os identificadores exigirão um
procedimento Apple de migração revisado, não associação por e-mail.

Referências: [ambiente Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple),
[fluxo web e POST](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple),
[discovery Apple](https://appleid.apple.com/.well-known/openid-configuration).

## Vinculação segura de conta existente

A chave é `(provider, providerAccountId=sub)`, protegida pelo índice único já
existente. Não se converte UUID nem se usa o e-mail como chave do vínculo.

- Vínculo existente: reutiliza userId, sem substituir e-mail/senha/role por claims.
- Identidade nova com e-mail verificado não cadastrado: cria CUSTOMER e Account
  em transação; ignora qualquer claim de papel administrativo.
- E-mail igual a conta local: retorna account_link_required (409). Não une contas
  automaticamente, inclusive com diferenças de maiúsculas em registros antigos.
- Concorrência: constraints + transação impedem usuários/vínculos duplicados; uma
  corrida sobre o mesmo provider/sub pode ser repetida uma vez após ler o vínculo.

Para associar conscientemente uma identidade a uma conta local, existe o mesmo
POST start com `link:true`, sessão FocusStore válida e senha local confirmada:

```js
// Executar no contexto da própria loja HTTPS, após login por senha.
const response = await fetch('/api/auth/social/google/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ link: true, password: senhaDigitadaAgora, returnTo: '/conta' }),
});
const result = await response.json();
if (response.ok) window.location.assign(result.url);
```

Apple usa o mesmo procedimento com `/apple/start`. A sessão é revalidada no
callback; revogação/expiração impede vinculação. Não se vincula um sub já ligado
a outro userId. Hash de senha e papel existentes são preservados.

Não foi criada interface nova de vinculação: os dois botões fazem login normal.
Assim, uma colisão com conta local exige o procedimento autenticado acima.
Contas sociais sem senha local não recebem um fallback inseguro para associar
outro provedor; precisam de um futuro fluxo próprio de reautenticação.

## Erros, cancelamento e limites

Falhas de configuração/início aparecem no aviso já existente do modal; o botão
é reativado. Sucesso redireciona ao provider sem novo modal/página React.

Falhas no callback (incluindo cancelamento) retornam resposta HTTP JSON com
mensagem segura, sem tokens/stack trace. O usuário pode voltar à loja pelo
navegador. Não foi adicionada UI para consumir erros de callback por query string,
respeitando a autorização de mudar somente os dois eventos do modal.

ReturnTo é limitado a caminhos locais; URLs externas, //host, barras invertidas,
controles e caminhos de API não são aceitos. Corpos de início/callback têm limites.
O limite de tentativas em memória não substitui proteção distribuída/proxy confiável.
Transações abandonadas expiram, mas não há limpeza automática em massa da tabela;
planejar manutenção restrita a registros social expirados conforme retenção.

## Vercel e teste real

Configurar as variáveis de servidor no ambiente correto e usar a mesma origem
canônica registrada nos provedores. Todos os workers precisam compartilhar
SOCIAL_LOGIN_SECRET e armazenamento durável das quatro tabelas utilizadas.

O código não muda a infraestrutura SQLite existente nem migra para PostgreSQL.
Sem persistência compartilhada entre início e callback, state/conta/sessão não
são confiáveis entre instâncias. Não usar SQLite efêmero em /tmp como solução.
A declaração de login tradicional funcionando não comprova durabilidade entre
instâncias nem funcionamento OAuth real; validar esses pontos na implantação.

Após configurar: testar novo usuário Google, conta já vinculada, Apple/relay,
retorno posterior sem e-mail, cancelamento, erro de callback, colisão local,
vinculação explícita, logout, login por senha, sessão da conta e autorização admin.
Usar contas controladas de homologação e HTTPS; não executar seeds/reset de banco.

## Testes automatizados e arquivos

`tests/social.test.ts` usa SQLite novo e transporte OIDC simulado, com RSA/JWKS
reais de teste e JWTs assinados. Verifica state/nonce/PKCE, assinatura incorreta,
issuer/audience/exp inválidos, replay/cancelamento, novas contas, vínculos, relay,
e-mail não verificado, colisão admin, senha e concorrência. Também valida o JWT
ES256 Apple, sem chave real. Nenhum endpoint público de mock é implementado.

`tests/store.test.ts` comprova que sessão social funciona com as APIs atuais de
sessão/logout e que login por senha continua válido, além das regressões anteriores.
Fixtures e saídas Next ficam em `.local-validation/`, sem tocar no banco comercial
nem encerrar um servidor de desenvolvimento já aberto. `next.config.ts` mantém
os defaults da aplicação; flags internas permitem saída/tsconfig exclusivos de teste.

Arquivos alterados/adicionados:

- `src/components/layout/login-modal.tsx`: somente eventos Google e Apple.
- `src/app/api/auth/social/[provider]/{start,callback}/route.ts`: endpoints Node.
- `src/lib/auth/social/{config,flow,http,persistence}.ts`: configuração OIDC,
  transação cifrada/one-time, callbacks e persistência compatível.
- `.env.example`, `package.json`, `package-lock.json`: configuração e bibliotecas.
- `tests/social.test.ts`, `tests/store.test.ts`, `tests/helpers/next-config.ts`:
  testes, compatibilidade e isolamento de processos/arquivos.
- `next.config.ts`: flags de isolamento; `tsconfig.json` principal preservado.
- `docs/SOCIAL_LOGIN.md`: instruções e pendências.

Comandos solicitados: `npm run typecheck`, `npm test`, `npm run build`.
Resultados e limitações da execução local constam a seguir.

## Resultado local da validação

- `npm run typecheck`: passou.
- `npm test`: 32 testes passaram (15 OAuth + 17 regressões/HTTP tradicionais).
- Modo contra `next start` isolado: os mesmos 32 testes passaram; os provedores
  continuaram simulados, sem alegação de login real Google/Apple.
- Build Next.js com cliente Prisma já gerado: passou, incluindo as duas rotas
  sociais novas e verificação TypeScript.
- `npm run build` foi executado, mas sua etapa `prisma generate` encontrou EPERM
  ao substituir a DLL carregada pelo servidor Windows que já estava aberto.
  Esse servidor foi preservado. Como o schema não mudou, validou-se `next build`
  diretamente em saída isolada; repetir o comando completo após encerrar o
  servidor de desenvolvimento em momento autorizado.
- `npm audit`: zero vulnerabilidades reportadas.
- `tsconfig.json` principal permaneceu sem alterações. A primeira tentativa do
  teste HTTP encontrou conflito com o next dev existente; o isolamento de saída
  resolveu. O caminho de aliases do tsconfig isolado foi corrigido para usar
  caminho relativo no Windows e a suíte/build foram repetidos com sucesso.

Aviso remanescente: interpretação ESM de tailwind.config.ts no build. Nenhuma
falha foi ocultada com ignoreBuildErrors, continue-on-error ou equivalentes.
Os bancos reais não foram usados nos testes, nem alterados pela implementação.
Não houve alteração de credenciais locais, migrations, commit, push ou deploy.

Pendências para declarar operacional: credenciais Google válidas, configuração
Apple/Services ID/chave, domínio HTTPS e callbacks registrados, segredo estável,
persistência durável compartilhada e teste real de consentimento/callback/sessão
nos ambientes autorizados. Os painéis externos não foram acessados.
