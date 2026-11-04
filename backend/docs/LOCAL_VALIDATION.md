# Validação local do PostgreSQL

O fluxo local usa exclusivamente o banco `focusstore_test` em
`127.0.0.1:5432`. Ele não lê `backend/.env`, porque esse arquivo pode apontar
para o Supabase.

## Diagnóstico somente leitura

No diretório raiz do repositório, execute:

```powershell
.\backend\.venv\Scripts\python.exe .\backend\scripts\local_validation.py
```

O script solicita a senha sem eco, constrói a URL com `SQLAlchemy URL.create`,
valida a identidade efetiva do servidor e exibe somente metadados e contagens.
Nenhuma senha é salva, impressa ou passada como argumento.

## Migrations locais

Somente depois de confirmar que o diagnóstico apontou para o banco descartável
autorizado, execute explicitamente:

```powershell
.\backend\.venv\Scripts\python.exe .\backend\scripts\local_validation.py --migrate --confirm-migrations
```

Essa opção exige duas flags, confirma novamente o destino e passa a conexão já
validada ao Alembic. O `.env` remoto não substitui essa conexão. O script não
executa seeds, resets, imports ou downgrades.

Se as contagens exibidas pelo diagnóstico forem diferentes de zero, a migration
é interrompida por padrão. Depois de revisar que são dados fictícios do banco de
teste, acrescente explicitamente `--allow-existing-data` ao comando; essa opção
não apaga nem substitui registros.

Se houver tabelas públicas fora do catálogo permitido ou uma revisão Alembic
desconhecida, a execução é interrompida antes de qualquer migration.

## Saída a compartilhar

É seguro compartilhar as linhas de versão do servidor, tabelas, revisões e
contagens. Não compartilhe a senha nem uma URL completa de conexão.
