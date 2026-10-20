# Agentes e Skills deste Projeto

Este guia explica onde encontrar as personalizações de IA do workspace e como testar o agente de revisão.

Se você não estiver familiarizado com o conceito de agentes, consulte [Agentes e Skills] ou fala com a eduarda.

## O que é o quê

| Item | Localização | Para que serve |
| --- | --- | --- |
| **Agente Segurança e Qualidade** | `.github/agents/seguranca-qualidade.agent.md` | Especialista selecionado no chat para revisar código, segurança, backend e qualidade. Analisa o pedido e propõe mudanças, solicitando aprovação antes de editar arquivos. |
| **Skill Next Cache Components Adoption** | `.agents/skills/next-cache-components-adoption/` | Instruções especializadas utilizadas em tarefas relacionadas à adoção de Cache Components no Next.js. Não é um agente separado nem monitora o projeto continuamente. |
| **AGENTS.md** | `AGENTS.md`, na raiz do projeto | Contém instruções gerais que orientam o comportamento dos agentes neste workspace. |

O agente define **quem ajuda e como trabalha**. A skill fornece **um procedimento específico para determinada tarefa**. As instruções gerais do projeto servem como contexto compartilhado.

## Como encontrar e chamar o agente

1. Abra a pasta raiz `focustore` no VS Code.
2. Abra o Chat e selecione **Segurança e Qualidade** no seletor de agentes.
3. Envie uma solicitação de revisão, por exemplo:

   ```text
   Revise o fluxo de criação de pedidos no backend. Não altere arquivos; mostre evidências e riscos por prioridade.
   ```

O agente deve informar o escopo revisado, apresentar achados baseados em evidências e indicar eventuais limitações. Se recomendar mudanças, deve explicar a proposta e solicitar aprovação antes de editar arquivos.

## Teste seguro do agente

Use este teste para verificar se o agente está carregado e respeita o fluxo de aprovação, sem solicitar alterações no projeto.

**Prompt de teste:**

> Revise somente o fluxo de autenticação do backend. Não altere, crie ou exclua arquivos. Primeiro, explique quais arquivos e caminhos pretende inspecionar. Depois, apresente apenas achados sustentados por evidências. Se sugerir uma correção, descreva os arquivos envolvidos e a mudança proposta, mas pare para solicitar minha aprovação. Não mostre valores de segredos.

### O que verificar na resposta

- O seletor do chat mostra **Segurança e Qualidade** como agente ativo.
- A resposta delimita a revisão e apresenta evidências reais do código.
- Suspeitas são diferenciadas de problemas confirmados.
- Se nenhum problema for confirmado, isso é informado claramente.
- O agente não afirma ter revisado todo o projeto se inspecionou apenas um fluxo.
- Qualquer alteração proposta depende de aprovação explícita.
- Nenhum segredo ou dado sensível é reproduzido.

Para confirmar que o teste não alterou arquivos, confira o painel **Source Control** do VS Code antes e depois da execução.

Não aprove nenhuma proposta durante este teste.

Se o agente não aparecer no seletor, confirme que abriu a raiz do workspace e tente reabrir o seletor ou a janela do Chat para atualizar a lista de agentes.

## Teste opcional do fluxo de implementação

Para verificar a etapa posterior à aprovação, escolha um problema conhecido no código e solicite uma revisão com uma proposta concreta de correção.

Leia a proposta e aprove explicitamente somente se quiser que ela seja implementada.

Após a aprovação, verifique se o agente:

1. Limita as alterações ao escopo aprovado.
2. Evita mudanças não relacionadas à tarefa.
3. Executa as verificações adequadas, quando disponíveis.
4. Relata os resultados reais dos testes e das verificações.
5. Informa eventuais limitações ou verificações que não puderam ser executadas.

Não use um problema inventado como evidência de que existe uma vulnerabilidade.