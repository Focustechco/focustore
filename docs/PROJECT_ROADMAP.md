# Sequência de desenvolvimento

1. Recuperar as referências Git ausentes e decidir a linha de código a homologar.
2. Definir um banco PostgreSQL descartável compatível com o guard e preparar testes frontend compatíveis com o schema SQLite atual.
3. Executar a regressão HTTP de cliente, a matriz frontend e a suíte PostgreSQL. Corrigir apenas defeitos demonstrados e repetir os testes.
4. Avaliar a atualização de segurança do Next.js em ambiente isolado, com revisão do lockfile e regressões.
5. Validar exclusividade de escrita, reconciliação, identidade e recuperação antes de qualquer proposta de transferência comercial.

Na sequência da auditoria da CI, corrigir as falhas locais de integração e full-stack antes de homologar o workflow remoto. Verificar o job final e os artefatos em execução real autorizada.
