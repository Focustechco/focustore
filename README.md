<<<<<<< HEAD
teste
=======
﻿# FocusStore — agentes internos de qualidade

Implementação local na branch `back-end`, integrada ao backend existente.

- **Database Integrity Agent:** conectividade PostgreSQL, revisão Alembic, schema
  e integridade de categorias, em uma transação de somente leitura.
- **API Documentation Agent:** comparação determinística do OpenAPI nativo do
  FastAPI com uma referência versionada e relatório de possíveis incompatibilidades.
- **GitHub Actions:** testes e agentes em PRs para `back-end`, com PostgreSQL
  temporário e sem credenciais de produção ou deploy.

Consulte [o guia dos agentes](backend/docs/agents.md) para diagnóstico, comandos,
regras de integridade, testes, atualização do contrato e investigação do pipeline.
A referência da API está em [backend/docs/openapi.json](backend/docs/openapi.json).

Com o ambiente virtual ativo, a partir de `backend/` e com DATABASE_URL de desenvolvimento:

```powershell
python -m app.agents.integrity
python -m app.agents.openapi_check
python -m pytest -q -ra
```

Para atualizar intencionalmente o contrato, após revisar a alteração de API:

```powershell
python -m app.agents.openapi_check --write
```

As alterações ainda precisam de autorização para commit, push ou abertura de PR.
>>>>>>> back-end
