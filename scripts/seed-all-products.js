const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPAREL_COLORS_ALL = [
  { name: 'Preto', code: 'BLK', hex: '#0D0D0D' },
  { name: 'Branco', code: 'WHT', hex: '#FFFFFF' },
  { name: 'Laranja Focus', code: 'ORG', hex: '#FF6500' },
];
const APPAREL_COLORS_BW = [
  { name: 'Preto', code: 'BLK', hex: '#0D0D0D' },
  { name: 'Branco', code: 'WHT', hex: '#FFFFFF' },
];
const APPAREL_SIZES = ['PP', 'P', 'M', 'G', 'GG'];

async function seedAllProducts() {
  console.log('Seeding full catalog of Focus Store products...');

  // Ensure categories exist
  const getOrCreateCategory = async (name, slug, iconName, position) => {
    let cat = await prisma.category.findUnique({ where: { slug } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name, slug, iconName, position, isActive: true },
      });
    }
    return cat;
  };

  const catVestuario = await getOrCreateCategory('Vestuário', 'vestuario', 'Shirt', 1);
  const catAcessorios = await getOrCreateCategory('Acessórios', 'acessorios', 'Headphones', 2);
  const catLifestyle = await getOrCreateCategory('Lifestyle', 'lifestyle', 'Coffee', 3);
  const catTec = await getOrCreateCategory('Tecnologia', 'tecnologia', 'Smartphone', 4);
  const catColecoes = await getOrCreateCategory('Coleções', 'colecoes', 'Star', 5);

  // Cleanup old category 'casa-e-escritorio' if exists
  const oldCasaCat = await prisma.category.findUnique({ where: { slug: 'casa-e-escritorio' } });
  if (oldCasaCat) {
    await prisma.productCategory.deleteMany({ where: { categoryId: oldCasaCat.id } });
    await prisma.category.delete({ where: { id: oldCasaCat.id } });
  }

  // Cleanup removed product: 'suporte-notebook-focus'
  const oldNotebookStand = await prisma.product.findFirst({
    where: { OR: [{ slug: 'suporte-notebook-focus' }, { sku: 'FS-STAND-NB-001' }] },
  });
  if (oldNotebookStand) {
    await prisma.productImage.deleteMany({ where: { productId: oldNotebookStand.id } });
    await prisma.productCategory.deleteMany({ where: { productId: oldNotebookStand.id } });
    await prisma.collectionProduct.deleteMany({ where: { productId: oldNotebookStand.id } });
    const variants = await prisma.productVariant.findMany({ where: { productId: oldNotebookStand.id } });
    for (const v of variants) {
      await prisma.inventory.deleteMany({ where: { variantId: v.id } });
      await prisma.cartItem.deleteMany({ where: { variantId: v.id } });
      await prisma.orderItem.deleteMany({ where: { variantId: v.id } });
      await prisma.wishlistItem.deleteMany({ where: { variantId: v.id } });
    }
    await prisma.productVariant.deleteMany({ where: { productId: oldNotebookStand.id } });
    await prisma.product.delete({ where: { id: oldNotebookStand.id } });
  }

  let colFocusTech = await prisma.collection.findFirst({
    where: { OR: [{ slug: 'focus-tech' }, { slug: 'focus-lab' }] },
  });
  if (!colFocusTech) {
    colFocusTech = await prisma.collection.create({
      data: {
        name: 'Focus Tech',
        slug: 'focus-tech',
        headline: 'A essência do design minimalista e alta performance',
        description: 'Linha exclusiva desenvolvida com tecnologia têxtil de ponta e minimalismo.',
      },
    });
  } else {
    colFocusTech = await prisma.collection.update({
      where: { id: colFocusTech.id },
      data: {
        name: 'Focus Tech',
        slug: 'focus-tech',
        headline: 'A essência do design minimalista e alta performance',
        description: 'Linha exclusiva desenvolvida com tecnologia têxtil de ponta e minimalismo.',
      },
    });
  }

  let colFocusAmsterda = await prisma.collection.findUnique({ where: { slug: 'focus-amsterda' } });
  if (!colFocusAmsterda) {
    colFocusAmsterda = await prisma.collection.create({
      data: {
        name: 'Focus Amsterdã',
        slug: 'focus-amsterda',
        headline: 'Edição Especial Laranja Focus',
        description: 'Linha exclusiva em Laranja Focus inspirada na cultura urbana com logotipo oficial em branco puro.',
      },
    });
  } else {
    colFocusAmsterda = await prisma.collection.update({
      where: { id: colFocusAmsterda.id },
      data: {
        name: 'Focus Amsterdã',
        headline: 'Edição Especial Laranja Focus',
        description: 'Linha exclusiva em Laranja Focus inspirada na cultura urbana com logotipo oficial em branco puro.',
      },
    });
  }

  const PRODUCTS_DATA = [
    {
      name: 'T-Shirt Focus Amsterdã',
      slug: 'tshirt-focus-amsterda',
      sku: 'FS-AMS-TSHIRT-001',
      description: 'Camiseta oficial da coleção Focus Amsterdã na icônica cor Laranja Focus. Desenvolvida em fibra nobre Focus TechFiber™ (Algodão Egípcio 260g peletizado) com o logotipo oficial FOCUS® em branco puro centralizado. Equipada com tecnologia anti-odor contínua e tecido que não amassa.',
      shortDescription: 'Focus Amsterdã: Algodão egípcio 260g em Laranja Focus com logo oficial em branco puro.',
      basePrice: 89.90,
      promotionalPrice: null,
      imageUrl: '/images/products/camiseta-focus-orange.jpg',
      images: [
        { url: '/images/products/camiseta-focus-orange.jpg', isPrimary: true, altText: 'T-Shirt Focus Amsterdã Laranja' },
      ],
      categories: [catVestuario.id, catColecoes.id],
      collections: [colFocusAmsterda.id],
      isFeatured: true,
      variants: [
        { name: 'T-Shirt Focus Amsterdã - Laranja Focus / PP', sku: 'FS-AMS-TSHIRT-ORG-PP', color: 'Laranja Focus', colorHex: '#FF6500', size: 'PP', price: 89.90, stock: 25 },
        { name: 'T-Shirt Focus Amsterdã - Laranja Focus / P', sku: 'FS-AMS-TSHIRT-ORG-P', color: 'Laranja Focus', colorHex: '#FF6500', size: 'P', price: 89.90, stock: 35 },
        { name: 'T-Shirt Focus Amsterdã - Laranja Focus / M', sku: 'FS-AMS-TSHIRT-ORG-M', color: 'Laranja Focus', colorHex: '#FF6500', size: 'M', price: 89.90, stock: 50 },
        { name: 'T-Shirt Focus Amsterdã - Laranja Focus / G', sku: 'FS-AMS-TSHIRT-ORG-G', color: 'Laranja Focus', colorHex: '#FF6500', size: 'G', price: 89.90, stock: 40 },
        { name: 'T-Shirt Focus Amsterdã - Laranja Focus / GG', sku: 'FS-AMS-TSHIRT-ORG-GG', color: 'Laranja Focus', colorHex: '#FF6500', size: 'GG', price: 89.90, stock: 20 },
      ],
    },
    {
      name: 'Polo Focus Amsterdã',
      slug: 'polo-focus-amsterda',
      sku: 'FS-AMS-POLO-001',
      description: 'Camisa polo executiva techwear da coleção Focus Amsterdã em piquet inteligente com elastano de alta memória na cor Laranja Focus. Gola estruturada anti-enrolamento e logotipo oficial FOCUS® em branco puro no peito.',
      shortDescription: 'Focus Amsterdã: Piquet inteligente Laranja Focus com logotipo oficial FOCUS® branco.',
      basePrice: 179.90,
      promotionalPrice: null,
      imageUrl: '/images/products/polo-focus-orange.jpg',
      images: [
        { url: '/images/products/polo-focus-orange.jpg', isPrimary: true, altText: 'Polo Focus Amsterdã Laranja' },
      ],
      categories: [catVestuario.id, catColecoes.id],
      collections: [colFocusAmsterda.id],
      isFeatured: true,
      variants: [
        { name: 'Polo Focus Amsterdã - Laranja Focus / PP', sku: 'FS-AMS-POLO-ORG-PP', color: 'Laranja Focus', colorHex: '#FF6500', size: 'PP', price: 179.90, stock: 20 },
        { name: 'Polo Focus Amsterdã - Laranja Focus / P', sku: 'FS-AMS-POLO-ORG-P', color: 'Laranja Focus', colorHex: '#FF6500', size: 'P', price: 179.90, stock: 30 },
        { name: 'Polo Focus Amsterdã - Laranja Focus / M', sku: 'FS-AMS-POLO-ORG-M', color: 'Laranja Focus', colorHex: '#FF6500', size: 'M', price: 179.90, stock: 45 },
        { name: 'Polo Focus Amsterdã - Laranja Focus / G', sku: 'FS-AMS-POLO-ORG-G', color: 'Laranja Focus', colorHex: '#FF6500', size: 'G', price: 179.90, stock: 35 },
        { name: 'Polo Focus Amsterdã - Laranja Focus / GG', sku: 'FS-AMS-POLO-ORG-GG', color: 'Laranja Focus', colorHex: '#FF6500', size: 'GG', price: 179.90, stock: 20 },
      ],
    },
    {
      name: 'Boné Focus Amsterdã',
      slug: 'bone-focus-amsterda',
      sku: 'FS-AMS-CAP-001',
      description: 'Boné Dad Hat exclusivo da coleção Focus Amsterdã em sarja peletizada 100% algodão premium na vibrante cor Laranja Focus com o logotipo FOCUS® bordado em alto relevo 3D branco frontal. Fecho metálico ajustável com gravação a laser.',
      shortDescription: 'Focus Amsterdã: Sarja peletizada Laranja Focus com bordado 3D em branco puro e fecho metálico.',
      basePrice: 79.90,
      promotionalPrice: null,
      imageUrl: '/images/products/bone-focus-orange.jpg',
      images: [
        { url: '/images/products/bone-focus-orange.jpg', isPrimary: true, altText: 'Boné Focus Amsterdã Laranja' },
      ],
      categories: [catAcessorios.id, catVestuario.id, catColecoes.id],
      collections: [colFocusAmsterda.id],
      isFeatured: true,
      variants: [
        { name: 'Boné Focus Amsterdã - Laranja Focus / Único', sku: 'FS-AMS-CAP-ORG-U', color: 'Laranja Focus', colorHex: '#FF6500', size: 'Único', price: 79.90, stock: 50 },
      ],
    },
    {
      name: 'Garrafa Térmica Focus',
      slug: 'garrafa-termica-focus',
      sku: 'FS-BOTTLE-001',
      description: 'Inox 18/8 com isolamento térmico a vácuo 24h gelado / 12h quente. Capacidade de 750ml com acabamento em preto fosco e logo Focus gravado a laser.',
      shortDescription: 'Inox 18/8 com isolamento térmico 24h gelado / 12h quente. 750ml.',
      basePrice: 129.90,
      promotionalPrice: null,
      imageUrl: '/images/products/garrafa-focus.jpg',
      categories: [catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Garrafa Térmica Focus - Preto Fosco / 750ml', sku: 'FS-BOTTLE-BLK-750', color: 'Preto Fosco', colorHex: '#151515', size: '750ml', price: 129.90, stock: 50 },
      ],
    },
    {
      name: 'Copo Térmico Focus 350ml',
      slug: 'copo-termico-focus',
      sku: 'FS-TUMBLER-001',
      description: 'Copo térmico em inox 18/8 de parede dupla a vácuo com acabamento em Focus Orange e tampa acrílica hermética anti-respingos. 350ml.',
      shortDescription: 'Inox 18/8, parede dupla com vácuo e acabamento em Focus Orange. 350ml.',
      basePrice: 89.90,
      promotionalPrice: 79.90,
      imageUrl: '/images/products/copo-termico-focus.jpg',
      categories: [catLifestyle.id, catAcessorios.id],
      isFeatured: true,
      variants: [
        { name: 'Copo Térmico Focus - Laranja Focus / 350ml', sku: 'FS-TUMBLER-ORG-350', color: 'Laranja Focus', colorHex: '#FF6500', size: '350ml', price: 79.90, stock: 65 },
      ],
    },
    {
      name: 'Caneca Focus Lab',
      slug: 'caneca-focus-lab',
      sku: 'FS-MUG-001',
      description: 'Cerâmica premium fosca vitrificada com interior laranja Focus. 350ml de pura energia para os seus momentos de foco.',
      shortDescription: 'Cerâmica premium fosca com interior laranja Focus. 350ml.',
      basePrice: 49.90,
      promotionalPrice: null,
      imageUrl: '/images/products/caneca-focus.jpg',
      categories: [catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Caneca Focus Lab - Preto & Laranja / 350ml', sku: 'FS-MUG-BLK-350', color: 'Preto', colorHex: '#101010', size: '350ml', price: 49.90, stock: 80 },
      ],
    },
    {
      name: 'Moletom Focus Streetwear Hoodie',
      slug: 'moletom-focus-hoodie',
      sku: 'FS-HOODIE-STR-001',
      description: 'Moletom techwear premium em algodão nobre heavyweight 380g com tecnologia de conforto térmico adaptativo. Tecido com tratamento anti-odor contínuo, resistente a amassados e forro ultra macio peluciado que aquece sem pesar. Capuz estruturado de dupla camada, bolso frontal canguru ergonômico e acabamento reforçado anti-deformação.',
      shortDescription: 'Tecnologia térmica adaptativa, anti-odor e algodão heavyweight 380g ultra macio.',
      basePrice: 249.90,
      promotionalPrice: 219.90,
      imageUrl: '/images/products/moletom-focus-hoodie.jpg',
      images: [
        { url: '/images/products/moletom-focus-hoodie.jpg', isPrimary: true, altText: 'Moletom Focus Streetwear Hoodie - Preto' },
        { url: '/images/products/moletom-focus-white.jpg', isPrimary: false, altText: 'Moletom Focus Streetwear Hoodie - Branco' },
      ],
      categories: [catVestuario.id, catColecoes.id],
      collections: [colFocusTech.id],
      isFeatured: true,
      isApparel: true,
      colors: APPAREL_COLORS_BW,
    },
    {
      name: 'Polo Focus Tech',
      slug: 'moletom-focus-lab',
      sku: 'FS-POLO-TECH-001',
      description: 'Camisa polo tech executiva em piquet inteligente com elastano de alta memória. Tecnologia anti-odor antibacteriana, tecido que não amassa e respirabilidade ativa para reuniões e dias intensos de trabalho. Gola estruturada anti-enrolamento e caimento alinhado impecável.',
      shortDescription: 'Piquet inteligente anti-amasso, tecnologia anti-odor e caimento executivo moderno.',
      basePrice: 179.90,
      promotionalPrice: null,
      imageUrl: '/images/products/polo-focus.jpg',
      images: [
        { url: '/images/products/polo-focus.jpg', isPrimary: true, altText: 'Polo Focus Tech - Preto' },
        { url: '/images/products/polo-focus-white.jpg', isPrimary: false, altText: 'Polo Focus Tech - Branco' },
      ],
      categories: [catVestuario.id, catColecoes.id],
      collections: [colFocusTech.id],
      isFeatured: true,
      isApparel: true,
      colors: APPAREL_COLORS_BW,
    },
    {
      name: 'Boné Focus Lab',
      slug: 'bone-focus-lab',
      sku: 'FS-CAP-001',
      description: 'Dad hat estruturado em sarja premium com fecho de metal gravado e logo Focus bordado em alto relevo.',
      shortDescription: 'Sarja premium estruturada com fecho de metal e bordado tonal.',
      basePrice: 79.90,
      promotionalPrice: null,
      imageUrl: '/images/products/bone-focus.jpg',
      images: [
        { url: '/images/products/bone-focus.jpg', isPrimary: true, altText: 'Boné Focus Lab - Preto' },
        { url: '/images/products/bone-focus-white.jpg', isPrimary: false, altText: 'Boné Focus Lab - Branco' },
      ],
      categories: [catAcessorios.id, catColecoes.id],
      collections: [colFocusTech.id],
      isFeatured: true,
      variants: [
        { name: 'Boné Focus Lab - Preto / Único', sku: 'FS-CAP-BLK-U', color: 'Preto', colorHex: '#0D0D0D', size: 'Único', price: 79.90, stock: 60 },
        { name: 'Boné Focus Lab - Branco / Único', sku: 'FS-CAP-WHT-U', color: 'Branco', colorHex: '#FFFFFF', size: 'Único', price: 79.90, stock: 30 },
      ],
    },
    {
      name: 'Camisa Focus Techwear',
      slug: 'camiseta-focus-lab',
      sku: 'FS-TSHIRT-001',
      description: 'Camiseta techwear desenvolvida em fibra nobre Focus TechFiber™ (Algodão Egípcio 260g peletizado). Equipada com nanotecnologia anti-odor com íons de prata e fibras inteligentes anti-amasso (Wrinkle-Free) que desamassam naturalmente no corpo. Respirabilidade ativa e toque extremamente macio que não desbota nem cria bolinhas.',
      shortDescription: 'Focus TechFiber™: Tecnologia anti-odor com íons de prata, não amassa e toque ultra macio 260g.',
      basePrice: 89.90,
      promotionalPrice: null,
      imageUrl: '/images/products/camiseta-focus.jpg',
      images: [
        { url: '/images/products/camiseta-focus.jpg', isPrimary: true, altText: 'Camisa Focus Techwear - Preto' },
        { url: '/images/products/camiseta-focus-white.jpg', isPrimary: false, altText: 'Camisa Focus Techwear - Branco' },
      ],
      categories: [catVestuario.id, catColecoes.id],
      collections: [colFocusTech.id],
      isFeatured: true,
      isApparel: true,
      colors: APPAREL_COLORS_BW,
    },
    {
      name: 'Mousepad Focus Desk Mat',
      slug: 'mousepad-focus',
      sku: 'FS-MOUSEPAD-001',
      description: 'Mousepad profissional de alta densidade com base emborrachada antiderrapante e costura perimetral reforçada em Focus Orange.',
      shortDescription: 'Superfície de rastreio de precisão com bordas costuradas e base antiderrapante.',
      basePrice: 59.90,
      promotionalPrice: 49.90,
      imageUrl: '/images/products/mousepad-focus.jpg',
      categories: [catTec.id, catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Mousepad Focus - Laranja Focus / Padrão', sku: 'FS-PAD-ORG-STD', color: 'Laranja Focus', colorHex: '#FF6500', size: 'Padrão', price: 49.90, stock: 70 },
      ],
    },
    {
      name: 'Kit Canetas Executivas Focus (Trio)',
      slug: 'kit-canetas-focus',
      sku: 'FS-PENS-TRIO-001',
      description: 'Estojo executivo luxo com 3 canetas esferográficas metálicas em alumínio anodizado Laranja Focus com detalhes cromados e escrita suave.',
      shortDescription: 'Estojo de luxo com trio de canetas metálicas e detalhes cromados.',
      basePrice: 69.90,
      promotionalPrice: 59.90,
      imageUrl: '/images/products/kit-canetas-focus.jpg',
      categories: [catAcessorios.id, catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Kit Canetas Focus - Laranja Focus / Trio', sku: 'FS-PENS-TRIO-ORG', color: 'Laranja Focus', colorHex: '#FF6500', size: 'Trio 3 un', price: 59.90, stock: 55 },
      ],
    },
    {
      name: 'Caneta Focus Matte Black',
      slug: 'caneta-focus-black',
      sku: 'FS-PEN-BLK-001',
      description: 'Caneta esferográfica executiva em alumínio fosco acetinado preto com logo Focus em tampografia. Escrita macia e peso balanceado.',
      shortDescription: 'Alumínio preto fosco com escrita suave e peso balanceado.',
      basePrice: 24.90,
      promotionalPrice: 19.90,
      imageUrl: '/images/products/caneta-focus-black.png',
      categories: [catAcessorios.id, catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Caneta Focus - Preto / Único', sku: 'FS-PEN-BLK-U', color: 'Preto', colorHex: '#0D0D0D', size: 'Único', price: 19.90, stock: 150 },
      ],
    },
    {
      name: 'Suporte Articulado Focus para Celular & Tablet',
      slug: 'suporte-celular-focus',
      sku: 'FS-STAND-PHN-001',
      description: 'Suporte de mesa ergonômico em liga de alumínio usinado CNC com silicone anti-derrapante. Ajuste multi-ângulo para chamadas de vídeo, lives e produtividade.',
      shortDescription: 'Alumínio usinado CNC, articulação dupla e base com silicone anti-derrapante.',
      basePrice: 89.90,
      promotionalPrice: 79.90,
      imageUrl: '/images/products/suporte-celular-focus.jpg',
      categories: [catTec.id, catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Suporte Articulado Focus - Preto Fosco / Único', sku: 'FS-STAND-PHN-BLK', color: 'Preto Fosco', colorHex: '#151515', size: 'Único', price: 79.90, stock: 45 },
      ],
    },
    {
      name: 'Suporte Headphone Stand Focus',
      slug: 'suporte-headphone-focus',
      sku: 'FS-STAND-HDP-001',
      description: 'Pedestal premium para fones de ouvido em alumínio anodizado preto fosco com base ponderada em aço e apoio curvo ergonômico.',
      shortDescription: 'Alumínio anodizado preto fosco com base pesada de alta estabilidade.',
      basePrice: 119.90,
      promotionalPrice: null,
      imageUrl: '/images/products/suporte-headphone-focus.jpg',
      categories: [catTec.id, catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Suporte Headphone Focus - Preto Fosco / Único', sku: 'FS-STAND-HDP-BLK', color: 'Preto Fosco', colorHex: '#151515', size: 'Único', price: 119.90, stock: 35 },
      ],
    },
    {
      name: 'Pack de Stickers Focus Oficial',
      slug: 'stickers-focus',
      sku: 'FS-STICKERS-001',
      description: 'Cartela com 10 adesivos em vinil fosco e brilhante de alta durabilidade, resistentes a água, luz solar e riscos. Perfeitos para laptops, garrafas e cadernos.',
      shortDescription: 'Pack com 10 adesivos em vinil automotivo à prova d\'água com logos Focus.',
      basePrice: 19.90,
      promotionalPrice: null,
      imageUrl: '/images/products/stickers-focus.jpg',
      categories: [catAcessorios.id],
      isFeatured: true,
      variants: [
        { name: 'Pack de Stickers Focus - Multicor / 10 un', sku: 'FS-STK-PACK10', color: 'Multicor', colorHex: '#FF6500', size: 'Pack 10 un', price: 19.90, stock: 200 },
      ],
    },
    {
      name: 'Kit Chaveiros Focus Premium',
      slug: 'chaveiro-focus',
      sku: 'FS-KEYCHAIN-001',
      description: 'Chaveiros executivos em couro legítimo pespontado, metal escovado e fita tática com mosquetão reforçado e logo Focus gravado.',
      shortDescription: 'Couro legítimo, metal escovado e mosquetão tático reforçado.',
      basePrice: 39.90,
      promotionalPrice: null,
      imageUrl: '/images/products/chaveiros-focus-kit.jpg',
      categories: [catAcessorios.id],
      isFeatured: true,
      variants: [
        { name: 'Chaveiro Focus - Preto / Único', sku: 'FS-KEY-BLK-U', color: 'Preto', colorHex: '#0D0D0D', size: 'Único', price: 39.90, stock: 100 },
        { name: 'Chaveiro Focus - Laranja Focus / Único', sku: 'FS-KEY-ORG-U', color: 'Laranja Focus', colorHex: '#FF6500', size: 'Único', price: 39.90, stock: 80 },
      ],
    },
    {
      name: 'Caderno Focus Lab',
      slug: 'caderno-focus',
      sku: 'FS-NOTEBOOK-001',
      description: 'Caderno capa dura emborrachada soft-touch com elástico laranja Focus, fita marcadora e papel pólen 90g pautado.',
      shortDescription: 'Capa soft-touch, papel pólen 90g e elástico Focus Orange. A5.',
      basePrice: 39.90,
      promotionalPrice: null,
      imageUrl: '/images/products/caderno-focus.jpg',
      categories: [catLifestyle.id],
      isFeatured: false,
      variants: [
        { name: 'Caderno Focus Lab - Preto / A5', sku: 'FS-NOTEBOOK-BLK-A5', color: 'Preto', colorHex: '#0D0D0D', size: 'A5', price: 39.90, stock: 90 },
      ],
    },
    {
      name: 'Boné Focus Signature Curve Black',
      slug: 'bone-focus-signature',
      sku: 'FS-CAP-SIG-001',
      description: 'Boné aba curva em sarja peletizada 100% algodão premium com logo Focus 3D emborrachado frontal em laranja e branco. Fecho metálico ajustável com fivela personalizada gravada a laser, ilhós bordados para respiração e faixa interna acolchoada anti-suor.',
      shortDescription: 'Sarja peletizada 100% algodão, logo Focus 3D em relevo e fecho metálico.',
      basePrice: 99.90,
      promotionalPrice: 89.90,
      imageUrl: '/images/products/bone-focus-signature.jpg',
      categories: [catAcessorios.id, catVestuario.id, catColecoes.id],
      collections: [colFocusTech.id],
      isFeatured: true,
      variants: [
        { name: 'Boné Focus Signature - Preto / Único', sku: 'FS-CAP-SIG-BLK-U', color: 'Preto', colorHex: '#0D0D0D', size: 'Único', price: 89.90, stock: 75 },
      ],
    },
    {
      name: 'Caderno Espiral Focus Wire-o Hardcover',
      slug: 'caderno-espiral-focus',
      sku: 'FS-NOTEBOOK-WIREO-001',
      description: 'Caderno executivo com encadernação em espiral wire-o metálica dupla reforçada em preto fosco, capa dura acetinada soft-touch com logo Focus em alta definição laranja e branco. Miolo em papel pólen soft 90g (160 páginas pautadas) ideal para anotações técnicas, wireframes e planejamento de código sem sangramento de tinta.',
      shortDescription: 'Capa dura soft-touch, espiral wire-o reforçado e 160 páginas em papel pólen 90g.',
      basePrice: 59.90,
      promotionalPrice: 49.90,
      imageUrl: '/images/products/caderno-focus-espiral.jpg',
      categories: [catAcessorios.id, catTec.id, catLifestyle.id],
      isFeatured: true,
      variants: [
        { name: 'Caderno Espiral Focus - Preto / A5', sku: 'FS-NOTEBOOK-WIREO-A5', color: 'Preto', colorHex: '#0D0D0D', size: 'A5 (160 págs)', price: 49.90, stock: 85 },
      ],
    },
  ];

  for (const item of PRODUCTS_DATA) {
    console.log(`Upserting product: ${item.name} (${item.slug})...`);
    
    let product = await prisma.product.findFirst({
      where: { OR: [{ slug: item.slug }, { sku: item.sku }] },
    });

    if (product) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          name: item.name,
          slug: item.slug,
          sku: item.sku,
          description: item.description,
          shortDescription: item.shortDescription,
          basePrice: item.basePrice,
          promotionalPrice: item.promotionalPrice,
          isFeatured: item.isFeatured,
          status: 'ACTIVE',
        },
      });
    } else {
      product = await prisma.product.create({
        data: {
          name: item.name,
          slug: item.slug,
          sku: item.sku,
          description: item.description,
          shortDescription: item.shortDescription,
          basePrice: item.basePrice,
          promotionalPrice: item.promotionalPrice,
          isFeatured: item.isFeatured,
          status: 'ACTIVE',
        },
      });
    }

    // Update images
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    if (item.images && item.images.length > 0) {
      for (const img of item.images) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: img.url,
            isPrimary: img.isPrimary,
            altText: img.altText,
          },
        });
      }
    } else {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: item.imageUrl,
          isPrimary: true,
          altText: item.name,
        },
      });
    }

    // Update categories
    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    for (const catId of item.categories) {
      await prisma.productCategory.create({
        data: {
          productId: product.id,
          categoryId: catId,
        },
      });
    }

    // Update collections
    if (item.collections) {
      await prisma.collectionProduct.deleteMany({ where: { productId: product.id } });
      for (const colId of item.collections) {
        await prisma.collectionProduct.create({
          data: {
            productId: product.id,
            collectionId: colId,
          },
        });
      }
    }

    // Clean old variants and dependencies
    const existingVariants = await prisma.productVariant.findMany({
      where: { productId: product.id },
      select: { id: true },
    });
    for (const v of existingVariants) {
      await prisma.inventory.deleteMany({ where: { variantId: v.id } });
      await prisma.cartItem.deleteMany({ where: { variantId: v.id } });
      await prisma.orderItem.deleteMany({ where: { variantId: v.id } });
      await prisma.wishlistItem.deleteMany({ where: { variantId: v.id } });
    }
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });

    // Create Variants
    if (item.isApparel) {
      let pos = 0;
      const colorsToUse = item.colors || APPAREL_COLORS_ALL;
      for (const color of colorsToUse) {
        for (const size of APPAREL_SIZES) {
          const sku = `${item.sku}-${color.code}-${size}`;
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              name: `${item.name} - ${color.name} / ${size}`,
              sku,
              color: color.name,
              colorHex: color.hex,
              size: size,
              price: item.basePrice,
              promotionalPrice: item.promotionalPrice,
              position: pos++,
              inventory: {
                create: {
                  quantityAvailable: 30,
                  quantityReserved: 0,
                },
              },
            },
          });
        }
      }
    } else if (item.variants) {
      for (let i = 0; i < item.variants.length; i++) {
        const v = item.variants[i];
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            name: v.name,
            sku: v.sku,
            color: v.color,
            colorHex: v.colorHex,
            size: v.size,
            price: v.price,
            position: i,
            inventory: {
              create: {
                quantityAvailable: v.stock || 50,
                quantityReserved: 0,
              },
            },
          },
        });
      }
    }
  }

  console.log('✓ All 15 products in catalog seeded and linked with studio photos!');
}

seedAllProducts()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
