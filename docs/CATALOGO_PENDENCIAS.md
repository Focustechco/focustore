# Pendências do catálogo FocusStore

**Status da etapa: ADIADA — AGUARDANDO CONCLUSÃO DO FRONTEND PELA EQUIPE.**

Este documento registra o estado conhecido da reconciliação do catálogo. As
pendências abaixo não estão resolvidas e não devem ser tratadas como autorização
para importar, sobrescrever ou excluir dados.

## Escopo preservado

Enquanto o frontend estiver em desenvolvimento por outra equipe, não serão
alterados:

- páginas, componentes, estilos ou rotas do frontend;
- autenticação, catálogo, carrinho e pedidos do backend;
- produtos, usuários, sessões, pedidos ou estoque no PostgreSQL;
- bancos SQLite legados;
- seeds, migrations ou configurações de conexão;
- funcionalidades administrativas existentes.

Não foram executadas importações, seeds, migrations ou escritas no banco para
registrar estas pendências.

## Estado conhecido

Na última verificação informada pela equipe, o PostgreSQL local continha **22
produtos**.

As fontes consideradas na reconciliação foram:

- catálogo atualmente retornado pela FastAPI/PostgreSQL;
- `prisma/dev.db`;
- `prisma/dev.backup.db`;
- `prisma/seed.ts`;
- `scripts/seed-all-products.js`;
- referências de imagens sob `public/`;
- política de visibilidade em `src/modules/catalog/catalog-policy.ts`;
- importador e auditoria em `scripts/audit_catalog_sync.py` e
  `scripts/sync-catalog-local.ps1`.

## Pendências conhecidas

Os números abaixo são o último resultado registrado e deverão ser recalculados
após a conclusão do frontend:

- cinco conflitos entre fontes legadas;
- 39 variantes identificadas como ausentes na comparação;
- 11 referências de imagens ausentes;
- categoria `casa-e-escritorio` pendente de reconciliação;
- imagem da camisa C# ausente:
  `public/images/camisas/04_CSharp_alta_resolucao.png`;
- camisa C# atualmente ocultada pela política de catálogo;
- necessidade de confirmar quais dados legados são comerciais e quais são
  apenas seeds, mocks ou versões antigas.

Nenhum desses itens foi marcado como resolvido. Conflitos de slug, SKU, preço,
variante, imagem ou categoria não devem ser reconciliados automaticamente sem
uma regra aprovada pela equipe responsável pelo catálogo.

## Verificações a executar posteriormente

Quando o frontend for declarado concluído, a retomada deve seguir esta ordem:

1. revisar as alterações entregues pela equipe e confirmar as fontes realmente
   utilizadas pela interface;
2. executar auditoria somente leitura das fontes legadas e do PostgreSQL local;
3. comparar produtos, SKUs, slugs, variantes, imagens, categorias e estoque;
4. revisar individualmente os cinco conflitos e a categoria pendente;
5. confirmar a existência das imagens em `public/`;
6. decidir explicitamente a publicação ou permanência oculta da camisa C#;
7. preparar dry-run do importador seletivo;
8. somente após revisão e autorização, executar eventual importação transacional;
9. validar FastAPI, busca, catálogo, carrinho, cotação, pedidos e histórico;
10. realizar a validação visual final do fluxo completo de compra.

As verificações devem continuar usando exclusivamente o PostgreSQL local
autorizado (`127.0.0.1:5432/focusstore_test`, schema `public`). Não usar
Supabase como fallback e não modificar o SQLite legado.

## Próximo marco

A integração final está **adiada** até que os desenvolvedores do frontend
comuniquem que o trabalho está concluído e pronto para validação. Até esse
marco, este arquivo é apenas um registro de riscos e pendências; não constitui
resultado de auditoria final nem aprovação de importação.
