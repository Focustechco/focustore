# FocusStore — Revisão de segurança

## Implementado

- Checkout deriva a identidade da sessão e não confia no `userId` do browser.
- Idempotência é vinculada ao usuário ou ao e-mail de convidado.
- Reserva de estoque usa atualização condicional dentro de transação.
- Produtos com pedidos históricos são arquivados em vez de apagados.
- Rotas administrativas validam sessão, papel e origem.
- Uploads limitam tamanho, verificam assinatura do arquivo, bloqueiam SVG e normalizam imagens.
- Respostas HTTP não expõem mensagens internas de exceção.
- Seeds demonstrativos falham fechados sem autorização explícita.

## Evidência e limitações

As alterações passaram por typecheck, análise de problemas e verificação de diff. A validação comportamental de checkout, concorrência, upload e autorização ainda depende de testes executados em ambiente isolado.

## Riscos remanescentes

- O script `lint` não executa um linter real.
- A página `/login` agora reutiliza o `LoginModal` existente e restringe `returnTo` a caminhos internos; o fluxo completo ainda precisa de teste HTTP.
- O backend e o frontend ainda possuem fronteiras de domínio duplicadas.
- A integração real com PostgreSQL/Supabase não foi validada nesta etapa.
