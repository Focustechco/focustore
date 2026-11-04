require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const PRODUCT_DESCRIPTIONS = require("./product-descriptions.json");
const PRODUCT_WARRANTY = require("../src/modules/catalog/product-warranty.json");

const prisma = new PrismaClient();
const DEV_COLLECTION_DETAILS = {
  "camisa-dev-collection-python": {
    name: "Camisa Python",
    color: "azul, branco e amarelo, conforme o visual cadastrado",
  },
  "camisa-dev-collection-java": {
    name: "Camisa Java",
    color: "laranja, azul e branco, conforme o visual cadastrado",
  },
  "camisa-dev-collection-javascript": {
    name: "Camisa JavaScript",
    color: "amarelo, preto e branco, conforme o visual cadastrado",
  },
  "camisa-dev-collection-typescript": {
    name: "Camisa TypeScript",
    color: "azul e branco, conforme o visual cadastrado",
  },
  "camisa-dev-collection-csharp": {
    name: "Camisa C#",
    color: "laranja Focus, conforme o visual cadastrado",
  },
};

function withCompleteDevCollectionSections(slug, entry) {
  const details = DEV_COLLECTION_DETAILS[slug];
  if (!details || entry.description.includes("### 2. Especificações Técnicas")) {
    return entry.description;
  }

  return `${entry.description}

### 2. Especificações Técnicas
- Marca: Focus
- Produto: ${details.name} da DEV COLLECTION
- Categoria: camiseta de manga curta para uso casual
- Cores do cadastro: ${details.color}
- Estampa: impressão com grafismos e identidade da linguagem de programação
- Tamanhos, material, composição, gramatura e modelagem: não informados no cadastro do produto.
- Acabamentos de gola, punhos, barra e tipos de impressão: não informados separadamente; confirme na etiqueta da peça recebida.

### 3. Cuidados & Lavagem
Vista a camiseta pelo avesso e lave separadamente nas primeiras vezes. Use ciclo suave e água fria em temperatura máxima de 30 °C, com sabão neutro; evite alvejantes, amaciantes e produtos abrasivos que possam afetar o desenho. Não torça com força e não deixe de molho por tempo prolongado.

Seque à sombra, em local ventilado, sobre cabide ou superfície lisa. Não utilize secadora em alta temperatura nem passe o ferro diretamente sobre a estampa; passe do avesso em temperatura baixa. Guarde somente com o tecido seco e limpo.

### 4. Garantia & Trocas
A primeira troca por tamanho é gratuita em até 30 dias após o recebimento, conforme a FAQ da loja, com a peça nova, sem uso e com etiquetas originais. O arrependimento pode ser solicitado em até 7 dias corridos após o recebimento. Defeitos seguem os prazos da garantia legal aplicável e devem ser enviados para avaliação. Consulte a página Trocas e Devoluções para atendimento.`;
}

function withProductWarranty(description) {
  const descriptionWithoutWarranty = description
    .replace(/^### 4\.\s*Garantia & Trocas\s*$[\s\S]*$/m, "")
    .trimEnd();
  return `${descriptionWithoutWarranty}\n\n### 4. Garantia & Trocas\n${PRODUCT_WARRANTY.text}`;
}

async function updateProductDescriptions() {
  const allProducts = await prisma.product.findMany({
    select: {
      slug: true,
      description: true,
      collections: {
        select: { collection: { select: { slug: true } } },
      },
    },
  });
  const unconfiguredSlugs = allProducts
    .map((product) => product.slug)
    .filter((slug) => !PRODUCT_DESCRIPTIONS[slug]);

  if (unconfiguredSlugs.length > 0) {
    throw new Error(
      `No description content configured for database products: ${unconfiguredSlugs.join(", ")}`,
    );
  }

<<<<<<< HEAD
  const products = allProducts.filter(
    (product) => PRODUCT_DESCRIPTIONS[product.slug],
  );
=======
  const configuredSlugs = new Set(allProducts.map((product) => product.slug));
  const products = allProducts.filter((product) => PRODUCT_DESCRIPTIONS[product.slug]);
>>>>>>> 3901662ef67626b9c93f13d8836f5a3731178504
  await prisma.$transaction(
    products.map((product) =>
      prisma.product.update({
        where: { slug: product.slug },
        data: {
<<<<<<< HEAD
          description: withCompleteDevCollectionSections(
            product.slug,
            PRODUCT_DESCRIPTIONS[product.slug],
          ),
          shortDescription: PRODUCT_DESCRIPTIONS[product.slug].shortDescription,
=======
          description: withProductWarranty(
            isDevCollectionProduct(product)
              ? product.description
              : PRODUCT_DESCRIPTIONS[product.slug].description,
          ),
          ...(isDevCollectionProduct(product)
            ? {}
            : {
                shortDescription:
                  PRODUCT_DESCRIPTIONS[product.slug].shortDescription,
              }),
>>>>>>> 3901662ef67626b9c93f13d8836f5a3731178504
        },
      }),
    ),
  );

  const databaseSlugs = new Set(allProducts.map((product) => product.slug));
  const missingSlugs = Object.keys(PRODUCT_DESCRIPTIONS).filter(
    (slug) => !databaseSlugs.has(slug),
  );
  console.log(
<<<<<<< HEAD
    `Updated descriptions for ${products.length} catalog products, including the Dev Collection.`,
=======
    `Updated warranty text for ${products.length} catalog products; Dev Collection descriptions were otherwise preserved.`,
>>>>>>> 3901662ef67626b9c93f13d8836f5a3731178504
  );
  if (missingSlugs.length > 0) {
    console.log(`Skipped products not present in this database: ${missingSlugs.join(", ")}`);
  }
}

updateProductDescriptions()
  .catch((error) => {
    console.error("Failed to update product descriptions:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
