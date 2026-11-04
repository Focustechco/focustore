# FocusStore — Estratégia de testes

## Camadas

1. **Estático:** TypeScript, lint real quando a ferramenta estiver disponível, AST Python e verificação de diff.
2. **Unitário:** validações, tokens, origem, carrinho e regras sem Prisma ou rede.
3. **Integração backend:** SQLite temporário em `tmp_path` ou PostgreSQL local `_test` explicitamente configurado.
4. **Integração frontend:** Prisma apontando para `FOCUS_TEST_DATABASE_URL`, schema temporário por processo.
5. **Fullstack:** somente com processos locais e banco descartável comprovado.

## Guardas obrigatórios

- Recusar URL ausente, não PostgreSQL ou cujo banco não termine em `_test`.
- Recusar execução quando o schema Prisma ainda declarar `sqlite`; URL PostgreSQL e provider Prisma precisam ser compatíveis.
- Nunca usar `backend/.env` como fallback de testes.
- Nunca executar `prisma db push`, Alembic ou seed contra Supabase compartilhado.
- Não imprimir URLs, credenciais ou dados pessoais.
- Concorrência deve usar banco local real; SQLite não comprova semântica final do PostgreSQL.

## Estado atual

- TypeScript: executado com sucesso.
- Lint: o script atual é apenas alias de typecheck; lint real pendente.
- AST Python: 57 arquivos analisados com sucesso.
- pytest: bloqueado porque o ambiente não possui o pacote.
- Testes TypeScript: bloqueados por `uv_os_get_passwd returned ENOMEM` no runtime Node.
- Testes PostgreSQL/fullstack: bloqueados até existir infraestrutura local `_test`.
