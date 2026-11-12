# Fase 1B — correspondência auditável de variantes

## Auditoria anterior ao desenho do esquema

Inspeção de `prisma/schema.prisma`, modelos SQLAlchemy e adaptadores existentes:

| Aspecto | Prisma/SQLite | PostgreSQL |
|---|---|---|
| Produto/variante | String com default UUID, sem validação UUID no SQLite | PK inteira e public_id UUID único/imutável |
| SKU variante | String obrigatório/único | varchar(120) obrigatório/único |
| Produto pai | FK UUID textual | FK inteira; pai também tem public_id |
| Atributos | cor, hex, tamanho, modelo, nome | mesmos campos com limites de tamanho |
| Preços | Float | Numeric(10,2) |
| Inventário | opcional por variante, disponível/reservado, limiar/movimentos | opcional por variante, disponível/reservado; sem movimentos |
| Categorias | N:N e hierarquia, IDs textuais | N:N, hierarquia e categoria primária obrigatória |
| Extras do produto | SEO, dimensões, custo, coleções | não existem todos esses campos; price/stock legados adicionais |

Unicidade de SKU bruto não garante unicidade após NFKC/trim/casefold. Campos
obrigatórios não impedem strings vazias. Nenhum banco exige ao menos uma
variante por produto. Identidade do produto pai não pode ser deduzida de nome,
SKU ou ID numérico. Preço/estoque são dados mutáveis e não evidência suficiente.
Não existe identificador externo canônico compartilhado no esquema atual.

Consulta agregada somente leitura a `prisma/dev.db` em 12/11/2026: 21 produtos,
81 variantes, 0 produtos sem variantes, 0 SKU ausente, 0 duplicidade bruta ou
lower(trim), 0 variantes órfãs ou sem inventário, 4 produtos inativos e 0
variantes inativas. Esse resultado é uma amostra local, não um diagnóstico de
produção. A normalização Unicode será avaliada pelo diagnóstico interno.
Não consultamos PostgreSQL persistente; diferenças entre fontes são medidas
somente quando ambas são fornecidas explicitamente ao serviço de diagnóstico.

## Decisão

| Alternativa | Avaliação |
|---|---|
| PostgreSQL | FK local real, índices parciais, triggers e transação única para auditoria; nenhuma dependência de escrita no Prisma; remoção futura isolada |
| Prisma | não pode garantir FK para PostgreSQL; introduziria tabela/escritor no domínio transacional legado sem benefício |
| Serviço independente | mais infraestrutura, deploy e consistência distribuída; não elimina a ausência de FK entre bancos |

Adotamos PostgreSQL e um serviço Python interno, sem endpoints ou integração com
checkout. O ID Prisma é referência externa, jamais FK entre bancos. A identidade
PostgreSQL usa o public_id real da variante; inteiros não são convertidos em UUID.
Nenhum escritor automático por nome ou SKU será introduzido.

## Política conservadora de equivalência

Não há fonte confiável que permita aprovação automática. Candidatas são criadas
somente por solicitação explícita de um chamador interno. Verificação exige
revisão explícita com referência de evidência externa, conferência do pai e
atributos, e snapshots atuais de ambas as fontes. O responsável é registrado
quando fornecido; sua identidade nunca é inventada nem inferida do banco.
Essa referência é uma atestação operacional, não prova criptográfica de verdade.
Sem ela o vínculo permanece candidato. Não existe regra comercial para derivar
equivalência de preços, estoque, nomes ou apenas SKU.

## Modelo, estados e invariantes

`catalog_variant_mappings` tem PK inteira própria, namespace estável do catálogo
Prisma, UUID externo da variante, FK para `product_variants.public_id`, estado,
origem original, origem da última operação, responsável opcional, motivo,
evidência JSONB e timestamps com fuso. Não há FK para usuários Prisma. IDs externos
que não sejam UUIDs reais são rejeitados; não há adaptação artificial de inteiros.
Namespace deve identificar uma fonte lógica, não conter caminho/credencial ou
identidade pessoal; não trocar a fonte por outro banco sob o mesmo namespace.

Transições permitidas: criação → candidate; candidate → verified ou rejected;
verified → revoked. Rejected/revoked são terminais. Corrigir um vínculo exige
encerrar o anterior e criar outra candidata, preservando a história. Identidades,
origem de criação e created_at são imutáveis. Não há atualização silenciosa de
evidência nem reativação de um registro terminal.

Índices UNIQUE parciais reservam `(prisma_source, prisma_variant_id)` e
`postgres_variant_public_id` enquanto o estado é candidate/verified. O namespace
faz parte da identidade externa; a variante PostgreSQL não pode ser reclamada
por outra fonte ativa. Isso preserva registros históricos sem permitir dois
vínculos ativos. A FK RESTRICT mantém a variante local enquanto houver qualquer
histórico de correspondência, inclusive terminal. Desativação é preferível a
exclusão física; a retirada futura requer um plano de arquivamento.

## Serviço interno e contrato

`CatalogMappingService(Session, PrismaMappingSource(path_absoluto, namespace))`
oferece `candidate`, `verify`, `reject`, `revoke`, `state`, `by_prisma`,
`by_postgres`, `audit_links` e diagnóstico PostgreSQL. O adaptador Prisma expõe
`diagnostics` e usa a conexão existente `mode=ro` e `query_only`, sem criar banco.
Nenhum dado de usuários, sessões, pedidos ou pagamentos é lido por ele.

Resolução retorna `verified`, `not_found`, `pending`, `rejected`, `revoked` ou
`inconsistent`; operações inválidas retornam `conflict`. Somente `verified`
carrega o par resolvido. Consulta simples de estado não resolve identidades.
UUID inválido gera ValueError, em vez de conversão ou consulta por outro campo.
Não há fallback por nome, SKU, inteiro ou outra fonte. A seleção de catálogo
continua `legacy_sqlite` por padrão; OpenAPI e rotas existentes não mudam.

O serviço exige PostgreSQL migrado. O chamador interno é responsável por sua
transação, inclusive por commit de resultados `conflict` para persistir os
eventos; rollback desfaz conjuntamente estado e auditoria. Usar uma unidade de
trabalho dedicada e contexto real da operação. Não fornecemos um endpoint ou
CLI administrativo autenticado nesta fase; a integração futura precisará de
controle de acesso antes de expor essas operações.

Exemplo conceitual (identidades sintéticas, nunca inferidas entre si):

```python
source = PrismaMappingSource(prisma_snapshot_path, 'prisma-primary')
with Session(engine) as db, db.begin():
    service = CatalogMappingService(db, source)
    result = service.candidate(prisma_variant_uuid, postgres_variant_public_uuid,
        source='controlled-import-review', reason='Revisão do lote sintético 17')
    # candidate não autoriza resolução; não há qualquer chamada ao checkout.

with Session(engine) as db, db.begin():
    service = CatalogMappingService(db, source)
    result = service.verify(mapping_id, source='controlled-review',
        reason='Conferência explícita dos registros de origem', actor=None,
        review={'confirmed': True, 'parent_checked': True,
                'attributes_checked': True, 'reference': 'synthetic-import-record:17'})
```

O chamador não deve fabricar `actor` quando não há uma identidade real. Motivo,
referência e origem devem ser referências técnicas concisas, sem nomes, emails,
documentos pessoais ou cópias integrais de documentos de revisão.

## Evidências e divergências

Classificações são `absent`, `incompatible`, `ambiguous`, `potential`,
`verifiable`. Inatividade de pai/variante, SKU ausente/divergente ou atributos
preenchidos contraditórios tornam o par incompatível; colisão de SKU normalizado
torna ambíguo. Pai com SKU desconhecido/divergente ou atributo presente em uma
fonte apenas exige reconciliação e permanece potencial. `verifiable` somente
habilita a revisão explícita; nunca promove automaticamente.

Snapshots registram IDs reais de variante/pai, SKU, atributos, ativação, preços
e quantidades atuais. NFKC/trim/casefold servem apenas ao diagnóstico, nunca
alteram os dados ou criam vínculos. A conferência manual do pai continua
obrigatória mesmo com SKU igual. A referência de revisão deve apontar para uma
evidência independente suficiente (por exemplo, registro controlado de importação
ou documentação do fabricante); um SKU copiado não basta.

Um hash de identidade detecta mudanças posteriores nos IDs, SKUs, atributos,
ativação e cardinalidade do SKU normalizado. Preços/estoques são comparados e
relatados, mas não entram no hash e não são sincronizados. Divergência neles não
transforma a tabela em autoridade financeira ou de estoque. Antes de resolver,
o serviço relê ambas as fontes e renova objetos ORM já em cache para observar
revogações externas. Se a identidade mudou, revogar/revisar explicitamente;
nunca sobrescrever a evidência de um vínculo verificado.

`audit_links(after_id=..., limit=...)` percorre páginas de até 1.000 vínculos,
inclusive históricos, e detecta referências Prisma ausentes ou fonte inacessível.
Diagnósticos por fonte detectam produtos sem variantes, SKU vazio, duplicidades
brutas/Unicode, normalização, inativos e órfãos de produto. Nenhum diagnóstico
cria ou verifica um vínculo. A amostra Prisma também foi reavaliada com Unicode:
0 colisões normalizadas; 81 SKUs mudam ao aplicar casefold (maiúsculas).

## Auditoria e concorrência

`catalog_mapping_events` é append-only e referencia a correspondência. Eventos
MappingCandidateCreated, MappingVerified, MappingRejected e MappingRevoked são
gerados por trigger AFTER INSERT/UPDATE na mesma transação da mudança. Contêm
estado anterior/posterior, origem, timestamp do servidor, ator opcional, motivo
e evidência daquele momento. Falha ao gravar o evento aborta a mudança de estado.
INSERT manual de evento de estado é bloqueado; conflitos são registrados pelo
serviço como MappingConflictDetected, sem alterar o estado atual.

Triggers validam estados/transições, contexto, imutabilidade da identidade e
estrutura mínima de evidência de verificação; não podem consultar a existência
de um registro Prisma em outro banco. DELETE e TRUNCATE de histórico/vínculos,
e UPDATE de eventos, são bloqueados. Não há SECURITY DEFINER nem extensões novas.
Operadores com privilégios de DDL/superusuário podem contornar os guards; usar
papéis de execução sem esses privilégios em uma futura implantação.

Transições usam SELECT FOR UPDATE; índices parciais são a proteção final para
criações concorrentes. Um savepoint recupera violações de unicidade para registrar
conflito. Duas verificações concorrentes produzem uma verificação e um conflito,
sem perder eventos. Nenhum isolamento entre dois bancos é prometido: snapshots
são observações pontuais. Este resolvedor nunca deve autorizar uma compra;
uma integração transacional futura exigirá outra autoridade e outro contrato.

## Migration e operação

Revision `e2f3a4b5c6d7` após `d1e2f3a4b5c6`: cria duas tabelas vazias, índices,
FKs locais e funções/triggers. Não preenche correspondências, altera catálogo,
reescreve PKs/FKs antigas ou toca Prisma. Criação de FK requer locks DDL breves
na tabela referenciada; medir e configurar limites de espera antes de futura
implantação. A revisão incremental não faz o backfill da Fase 1A novamente.

DDL PostgreSQL e revisão Alembic são transacionais; corrigir a causa e repetir
upgrade após uma falha, sem `stamp`. `upgrade head` repetido é um no-op. Downgrade
remove apenas estruturas vazias e recusa execução se existir qualquer histórico
de mapping, evitando apagamento silencioso. Nunca usar downgrade como mecanismo
operacional de revogação: usar `revoke`.

Somente cluster descartável foi usado, com identidade conferida por SQL antes do
primeiro upgrade: banco `phase1b_test`, usuário focusstore, loopback porta 55445,
data directory `.tmp/phase1b-pg`. Nenhuma migration em Supabase ou banco persistente.
SQLite suporta as tabelas para testes antigos de contrato; os guards de histórico
e a operação do serviço de mapping são garantidos/testados apenas em PostgreSQL.

## Limitações, evolução e retirada

Não existe resolução distribuída forte nem autoridade de estoque compartilhada.
A avaliação de colisões normalizadas lê os SKUs das fontes (custo linear); o
catálogo atual é pequeno. Antes de uso em grande escala, medir e projetar índices
ou snapshots de diagnóstico sem enfraquecer a revisão explícita. Não habilitar
escritores autônomos ou endpoints públicos para contornar esta política.

Na próxima etapa, definir uma fonte canônica de equivalência e uma interface de
revisão protegida; operacionalizar revisão/revogação e scans de órfãos. Migrações
de checkout, estoque, pagamentos e usuários continuam separadas e não foram
iniciadas. Após todos os consumidores adotarem identidades PostgreSQL, interromper
novos vínculos, revogar os ainda ativos, exportar histórico e evidências com
retenção/integridade verificadas e aprovar migration específica de retirada.
O downgrade atual não é um atalho para apagar o histórico.

## Validação desta entrega

- Backend: 167 testes passaram, incluindo 33 novos testes de correspondência;
  um aviso de depreciação Starlette/httpx já existente.
- Frontend: TypeScript aprovado; 41 testes passaram em cópia descartável de
  código, sem arquivos `.env` nem conteúdo dos bancos locais; 5 testes fullstack
  passaram com SQLite temporário e executável Python explícito.
- Alembic upgrade/check, integridade PostgreSQL, OpenAPI e pip check passaram.
- A primeira execução frontend encontrou problema de preparação do engine Prisma;
  uma repetição isolada passou. Na suíte completa, um teste de variável ausente
  recarregou o `.env` local pelo Prisma; a cópia descartável sem `.env` eliminou
  a contaminação e passou a suíte completa sem alterar produto ou seus testes.
- OpenAPI, schema Prisma, checkout, autenticação, pedidos, pagamentos e módulos
  de estoque transacional não tiveram alterações. Não há integração automática
  deste serviço com leitores públicos ou fluxos de compra.
