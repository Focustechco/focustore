require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const PRODUCT_DESCRIPTIONS = require("./product-descriptions.json");
const PRODUCT_WARRANTY = require("../src/modules/catalog/product-warranty.json");

const prisma = new PrismaClient();
const LEGACY_DEV_COLLECTION_SLUGS = new Set([
  "tshirt-focus-collection",
  "polo-focus-collection",
  "bone-focus-collection",
]);

function isDevCollectionProduct(product) {
  return (
    product.slug.startsWith("camisa-dev-collection-") ||
    LEGACY_DEV_COLLECTION_SLUGS.has(product.slug) ||
    product.collections.some(({ collection }) =>
      ["dev-collection", "focus-collection"].includes(collection.slug),
    )
  );
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

  const configuredSlugs = new Set(allProducts.map((product) => product.slug));
  const products = allProducts.filter((product) => PRODUCT_DESCRIPTIONS[product.slug]);
  await prisma.$transaction(
    products.map((product) =>
      prisma.product.update({
        where: { slug: product.slug },
        data: {
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
        },
      }),
    ),
  );

  const missingSlugs = Object.keys(PRODUCT_DESCRIPTIONS).filter(
    (slug) =>
      !configuredSlugs.has(slug) &&
      !LEGACY_DEV_COLLECTION_SLUGS.has(slug) &&
      !slug.startsWith("camisa-dev-collection-"),
  );
  console.log(
    `Updated warranty text for ${products.length} catalog products; Dev Collection descriptions were otherwise preserved.`,
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
