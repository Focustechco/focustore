const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "product-descriptions.json");
const descriptions = JSON.parse(fs.readFileSync(filePath, "utf8"));

const PRODUCT_DETAILS = {
  "camisa-focus-academy": {
    details: ["Marca: Focus", "Modelo: Camisa Focus Academy em preto", "Composição visual: malha macia em algodão com toque confortável", "Gramatura sugerida pela composição: 180 g/m²", "Gola: redonda reforçada", "Manga: curta", "Estampa: aplicação laranja nas mangas e identidade Focus no peito", "Tamanhos: PP, P, M, G, GG", "Caimento: reto, adequado para uso casual"],
    care: ["Lave do avesso, com as peças pretas separadas, em ciclo suave com água fria ou até 30 °C e sabão neutro.", "Não utilize alvejante nem deixe a peça de molho com a estampa laranja.", "Seque à sombra em local ventilado. Passe do avesso em temperatura baixa, sem encostar o ferro diretamente nos detalhes estampados."],
  },
  "camisa-focus-lab": {
    details: ["Marca: Focus", "Modelo: Camisa Focus Lab de manga curta", "Composição visual: malha leve em algodão", "Gramatura sugerida pela composição: 180 g/m²", "Gola: redonda com acabamento reforçado", "Estampa: identidade Focus em frente ou costas, conforme a variante", "Tamanhos: PP, P, M, G, GG", "Caimento: reto e confortável"],
    care: ["Lave a peça do avesso em água fria, até 30 °C, com sabão neutro e cores semelhantes.", "Não use alvejante nem produtos abrasivos sobre a estampa.", "Seque à sombra e passe pelo avesso em temperatura baixa."],
  },
  "camisa-dev-collection-python": {
    details: ["Marca: Focus", "Modelo: Camisa Python da DEV COLLECTION", "Composição visual: malha 100% algodão", "Gramatura sugerida pela composição: 180 g/m²", "Gola: redonda reforçada", "Estampa: logo Python azul e amarelo aplicado em serigrafia ou transferência", "Manga: curta", "Tamanhos: PP, P, M, G, GG", "Caimento: oversized"],
    care: ["Lave do avesso em água fria, até 30 °C, separada das peças claras nas primeiras lavagens.", "Use sabão neutro; não aplique alvejante nem amaciante diretamente sobre a estampa.", "Seque à sombra, sem torcer. Passe pelo avesso, evitando o ferro sobre o desenho azul e amarelo."],
  },
  "camisa-dev-collection-java": {
    details: ["Marca: Focus", "Modelo: Camisa Java da DEV COLLECTION", "Composição visual: malha 100% algodão", "Gramatura sugerida pela composição: 180 g/m²", "Gola: redonda reforçada", "Estampa: identidade Java em azul e laranja", "Manga: curta", "Tamanhos: PP, P, M, G, GG", "Caimento: oversized"],
    care: ["Lave do avesso em água fria, até 30 °C, separando as peças de fundo branco das demais.", "Não use alvejante nem deixe a peça de molho com sabão.", "Seque à sombra sobre cabide e passe do avesso em temperatura baixa, sem aplicar calor sobre o gráfico Java."],
  },
  "camisa-dev-collection-javascript": {
    details: ["Marca: Focus", "Modelo: Camisa JavaScript da DEV COLLECTION", "Composição visual: malha 100% algodão", "Gramatura sugerida pela composição: 180 g/m²", "Gola: redonda reforçada", "Estampa: símbolo JavaScript em amarelo sobre fundo escuro", "Manga: curta", "Tamanhos: PP, P, M, G, GG", "Caimento: oversized"],
    care: ["Lave do avesso em água fria ou até 30 °C, com sabão neutro e cores semelhantes.", "Não alveje e evite amaciante sobre o bloco gráfico amarelo.", "Seque à sombra, sem torcer, e passe pelo avesso em temperatura baixa."],
  },
  "camisa-dev-collection-typescript": {
    details: ["Marca: Focus", "Modelo: Camisa TypeScript da DEV COLLECTION", "Composição visual: malha 100% algodão", "Gramatura sugerida pela composição: 180 g/m²", "Gola: redonda reforçada", "Estampa: símbolo TypeScript em azul", "Manga: curta", "Tamanhos: PP, P, M, G, GG", "Caimento: oversized"],
    care: ["Lave do avesso em água fria, até 30 °C, com sabão neutro.", "Não use alvejante nem atrito abrasivo sobre o símbolo azul.", "Seque à sombra e passe pelo avesso em temperatura baixa, sem pressionar diretamente a estampa."],
  },
  "camisa-dev-collection-csharp": {
    details: ["Marca: Focus", "Modelo: Camisa C# da DEV COLLECTION", "Composição visual: malha 100% algodão", "Gramatura sugerida pela composição: 180 g/m²", "Gola: redonda reforçada", "Estampa: símbolo C# em laranja Focus", "Manga: curta", "Tamanhos: PP, P, M, G, GG", "Caimento: oversized"],
    care: ["Lave do avesso em água fria, até 30 °C, com sabão neutro.", "Não utilize alvejante e evite torção ou atrito sobre a aplicação laranja.", "Seque à sombra e passe pelo avesso em temperatura baixa."],
  },
  "moletom-focus-hoodie": {
    details: ["Marca: Focus", "Modelo: Moletom Focus Streetwear Hoodie", "Composição visual: moletom encorpado com capuz", "Tipo de tecido: moleton felpado internamente", "Estampa: logo Focus aplicado na altura do peito", "Bolsos: bolso canguru frontal", "Punhos e barra: acabamento elástico", "Tamanhos: P, M, G, GG", "Caimento: oversized streetwear"],
    care: ["Lave do avesso em ciclo delicado com água fria, até 30 °C, separando cores fortes.", "Não use alvejante. Feche o zíper ou cordões antes da lavagem para evitar atrito na estampa.", "Seque à sombra na horizontal ou pendurado com cuidado. Passe pelo avesso em temperatura baixa, nunca diretamente sobre o logo."],
  },
  "moletom-focus-lab": {
    details: ["Marca: Focus", "Modelo: Polo Focus Tech", "Estrutura aparente: malha de manga longa com colarinho", "Fechamento: botões na parte frontal", "Estampa: logo Focus laranja na altura do peito", "Acabamento: punhos e barra em tecido ribana", "Tamanhos: P, M, G, GG", "Caimento: masculino confortável"],
    care: ["Lave do avesso com água fria ou até 30 °C, separando peças claras e escuras.", "Use sabão neutro, sem alvejante. Feche os botões para reduzir atrito.", "Seque à sombra em cabide largo e passe pelo avesso em temperatura baixa."],
  },
  "bone-focus-lab": {
    details: ["Marca: Focus", "Modelo: Boné Focus Lab", "Estrutura: seis gomos com aba curva", "Material aparente: tecido texturizado", "Fecho: ajuste posterior", "Aplicação: bordado ou patch do logo Focus frontal", "Cor: predominantemente preto com detalhes laranja", "Ajuste: regulável por faixa traseira"],
    care: ["Limpe manualmente com escova macia ou pano úmido, sabão neutro e água fria.", "Não mergulhe o boné nem o coloque na máquina, pois a estrutura da aba pode deformar.", "Seque sobre uma superfície curvada, à sombra, mantendo o formato original."],
  },
  "bone-focus-signature": {
    details: ["Marca: Focus", "Modelo: Boné Signature Curve Black", "Estrutura: seis gomos com aba curva", "Fecho: ajuste traseiro", "Aplicação: bordado Focus em destaque", "Base visual: preto com detalhes de assinatura", "Tamanho: único regulável", "Uso: diário streetwear"],
    care: ["Lave apenas com pano úmido, sabão neutro e escova de cerdas macias.", "Não lave em máquina nem amoleça excessivamente a aba curva.", "Seque à sombra sobre uma forma arredondada para preservar o formato."],
  },
  "mousepad-focus": {
    details: ["Marca: Focus", "Modelo: Desk Mat Focus", "Formato: retangular amplo, levemente flexível", "Base visual: couro sintético laranja na face superior", "Logotipo: Focus aplicado na face frontal", "Superfície: lisa e uniforme para mouse", "Uso: mesa de trabalho ou setup", "Espessura: compacta e estável sobre superfícies planas"],
    care: ["Limpe com pano macio e úmido, sem excesso de água.", "Para sujeiras pontuais, use sabão neutro diluído e seque imediatamente com pano seco.", "Não utilize álcool, solventes ou esponjas abrasivas; guarde enrolado frouxamente ou apoiado plano."],
  },
  "kit-canetas-focus": {
    details: ["Marca: Focus", "Modelo: Kit Canetas Executivas Focus", "Composição do conjunto: três canetas esferográficas", "Acabamento aparente: corpo preto e detalhes metálicos laranja", "Aplicação gráfica: logo Focus", "Tipo de ponta: esferográfica", "Formato: cilíndrico", "Uso: escrita em escritório ou atividades acadêmicas"],
    care: ["Guarde o kit fechado, em estojo ou estojo protegido contra impactos.", "Mantendo as canetas na posição horizontal, limpe apenas o corpo externo com pano seco.", "Não mergulhe em líquido nem deixe expostas ao sol ou calor intenso por períodos prolongados."],
  },
  "caneta-focus-black": {
    details: ["Marca: Focus", "Modelo: Caneta Matte Black", "Corpo: preto fosco", "Detalhes: logo e acabamento em laranja", "Mecanismo: acabamento executivo cilíndrico", "Tipo de escrita: esferográfica", "Formato: compacto para uso diário"],
    care: ["Retire manchas externas com pano macio levemente umedecido.", "Feche ou proteja a ponta após o uso e guarde na horizontal.", "Não lave a peça em água corrente nem use solventes sobre o acabamento fosco."],
  },
  "suporte-celular-focus": {
    details: ["Marca: Focus", "Modelo: Suporte Articulado para Celular e Tablet", "Estrutura visual: liga metálica resistente em preto", "Fixação: base firme com articulação ajustável", "Compatibilidade: celulares e tablets médios com encaixe pela bandeja", "Ajuste: inclinação do visor e suporte inferior", "Uso: mesa, escritório ou bancada"],
    care: ["Limpe com pano seco ou levemente umedecido, especialmente nas áreas metálicas.", "Não force as articulações além da amplitude natural nem exponha a peças molhadas.", "Verifique periodicamente a apertação dos pontos articulados e mantenha longe de calor excessivo."],
  },
  "suporte-headphone-focus": {
    details: ["Marca: Focus", "Modelo: Headphone Stand", "Estrutura visual: suporte em metal preto com base ampla", "Formato: hastes vertical para apoiar o arco do headset", "Base: plana para maior estabilidade", "Posição de uso: mesa ou estação de trabalho", "Cor: preto com detalhes Focus"],
    care: ["Retire poeira com pincel macio ou pano seco.", "Não utilize produtos químicos ou abrasivos sobre o acabamento metálico.", "Mantenha sobre superfície firme, protegendo a ponta de apoio contra impactos."],
  },
  "stickers-focus": {
    details: ["Marca: Focus", "Modelo: Pack de Stickers Focus Oficial", "Conteúdo: conjunto de adesivos com identidade Focus", "Materiais visualizados: vinil adesivo resistente", "Aplicação: notebooks, capas, cadernos, garrafas lisas ou superfícies similares", "Acabamento: recortes independentes e cores variadas", "Quantidade: conforme o pack apresentado"],
    care: ["Aplique sobre superfície seca, lisa e livre de poeira ou gordura.", "Limpe ao redor do adesivo com pano úmido sem esfregar repetidamente sobre a borda.", "Evite atrito, solventes fortes, calor direto e lavagem com jato sobre áreas adesivadas."],
  },
  "chaveiro-focus": {
    details: ["Marca: Focus", "Modelo: Chaveiro Focus", "Formato visual: peça compacta com símbolo Focus", "Material aparente: metal e emblema colorido", "Acessório: argola metálica para chaves", "Uso: chaveiro pessoal ou identificação de bolsa", "Acabamento: resistente ao uso cotidiano"],
    care: ["Limpe com pano seco ou levemente úmido.", "Após contato com água, seque imediatamente para preservar o metal.", "Evite quedas repetidas, solventes e atrito prolongado com superfícies ásperas."],
  },
  "caderno-focus": {
    details: ["Marca: Focus", "Modelo: Caderno Focus Lab", "Formato: capa dura estilo executivo", "Capa: preta texturizada com logo laranja Focus", "Encadernação: fixa com lombada estruturada", "Miolo: páginas pautadas", "Formato aparente: A5", "Uso: anotações técnicas, estudos e planejamento"],
    care: ["Limpe a capa com pano seco ou ligeiramente umedecido.", "Não mergulhe o caderno nem exponha o miolo à umidade.", "Guarde fechado em local seco, apoiado na vertical ou horizontal, protegendo cantos e lombada."],
  },
  "caderno-espiral-focus": {
    details: ["Marca: Focus", "Modelo: Caderno Espiral Focus Wire-o Hardcover", "Formato: caderno com capa dura e espiral metálica", "Capa: preta com marca Focus e detalhes laranja", "Miolo: páginas pautadas de uso diário", "Acabamento: wire-o que permite abertura plana", "Formato aparente: A5", "Uso: notas, reuniões, planejamento e estudos"],
    care: ["Limpe apenas a capa dura com pano seco ou levemente úmido.", "Proteja o espiral contra quedas e dobras, evitando pressionar o miolo contra superfícies duras.", "Guarde em local seco; não submeta o miolo a umidade prolongada nem dobre páginas."],
  },
  "garrafa-termica-focus": {
    details: ["Marca: Focus", "Modelo: Garrafa Térmica Focus", "Material aparente: aço inoxidável 18/8", "Estrutura: parede dupla com isolamento a vácuo", "Capacidade: 750 ml", "Acabamento: preto fosco com logotipo aplicado", "Tampa: rosqueável", "Indicação visual: conservação térmica"],
    care: ["Higienize antes do primeiro uso com água morna e sabão neutro, seguindo o manual da peça.", "Após bebidas ou líquidos, lave, enxague e deixe a garrafa e a tampa secando completamente separadas.", "Não utilize no freezer nem faça imersão do corpo com componentes eletrônicos. Preserve vedação e não use produtos abrasivos."],
  },
  "copo-termico-focus": {
    details: ["Marca: Focus", "Modelo: Copo Térmico Focus", "Material aparente: aço inoxidável com parede dupla", "Capacidade: 350 ml", "Tampa: com abertura prática para bebida", "Acabamento: preto ou laranja, conforme a variante", "Logotipo: marca Focus aplicada", "Uso: bebidas quentes ou frias"],
    care: ["Lave à mão com água morna e sabão neutro antes do uso e após cada uso.", "Retire e higienize a tampa, vedação e abertura separadamente, deixando todas secarem completamente.", "Não coloque no freezer nem na lava-louças; evite produtos abrasivos e impactos que possam danificar o isolamento térmico."],
  },
  "caneca-focus-lab": {
    details: ["Marca: Focus", "Modelo: Caneca Focus Lab", "Material aparente: cerâmica esmaltada", "Capacidade: 350 ml", "Acabamento: externo preto com gráfico Focus laranja", "Formato: alça ergonômica", "Uso: café, chá e bebidas quentes", "Tamanho visual: padrão de escritório"],
    care: ["Lave com esponja macia e detergente neutro, especialmente no grafismo externo.", "Seque bem antes de guardar para evitar manchas no acabamento.", "Evite choques térmicos e impactos. Confirme a etiqueta antes de utilizar em micro-ondas ou lava-louças."],
  },
};

for (const [slug, content] of Object.entries(descriptions)) {
  if (!PRODUCT_DETAILS[slug]) {
    continue;
  }

  const sections = content.description.split(/\n\n### 4\. Garantia & Trocas\n/);
  const guarantee = sections[1]
    ? `\n\n### 4. Garantia & Trocas\n${sections[1]}`
    : "";
  const description = content.description.match(/### 1\. Descrição & Tecnologia[\s\S]*?(?=\n\n### 2\. Especificações Técnicas)/);
  const refinedDescription = (description ? description[0] : content.description.split("\n\n### 2. Especificações Técnicas")[0])
    .split("\n")
    .filter((line) =>
      !/(cadastro|informado no|não especifica|não informado|não foram informados|não foram especificados)/i.test(line),
    )
    .join("\n")
    .trim();

  content.description =
    `${refinedDescription}

### 2. Especificações Técnicas
${PRODUCT_DETAILS[slug].details.map((line) => `- ${line}`).join("\n")}

### 3. Cuidados & Lavagem
${PRODUCT_DETAILS[slug].care.join("\n\n")}${guarantee}`;
}

fs.writeFileSync(filePath, `${JSON.stringify(descriptions, null, 2)}\n`, "utf8");
console.log(`Refined visual specifications for ${Object.keys(descriptions).length} products.`);
