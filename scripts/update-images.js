const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const productImages = {
  "camisa-focus-lab": [
    {
      url: "/images/products/Camiseta-focus.png",
      altText: "Modelo vestindo Camisa Focus Techwear",
    },
    {
      url: "/images/products/camiseta-focus-preta-v2.png",
      altText: "Camisa Focus Techwear preta sem modelo",
    },
  ],
  "moletom-focus-lab": [
    {
      url: "/images/products/Polo-FocusModelo.png",
      altText: "Modelo vestindo a Polo Focus Tech",
    },
    { url: "/images/products/polo-focus.png", altText: "Polo Focus Tech" },
  ],
  "bone-focus-lab": [
    { url: "/images/products/bone-focus.jpg", altText: "Boné Focus Lab - Preto" },
    { url: "/images/products/bone-focus-white.png", altText: "Boné Focus Lab - Branco" },
  ],
  "bone-focus-signature": [
    {
      url: "/images/products/bone-focus-signature.png",
      altText: "Boné Focus Signature - Preto",
    },
    {
      url: "/images/products/bone-focus-white.png",
      altText: "Boné Focus Signature - Branco",
    },
  ],
  "caderno-focus": [
    { url: "/images/products/caderno-focus.png", altText: "Caderno Focus Lab" },
  ],
  "caneca-focus-lab": [
    { url: "/images/products/caneca-focus.png", altText: "Caneca Focus Lab" },
  ],
  "copo-termico-focus": [
    { url: "/images/products/copo-termico-focus.png", altText: "Copo Térmico Focus 350ml" },
  ],
  "garrafa-termica-focus": [
    { url: "/images/products/garrafa-focus.png", altText: "Garrafa Térmica Focus" },
  ],
  "kit-canetas-focus": [
    { url: "/images/products/kit-canetas-focus.png", altText: "Kit Canetas Focus" },
  ],
  "chaveiro-focus": [
    { url: "/images/products/chaveiro-focus.jpg", altText: "Kit completo de chaveiros Focus" },
    { url: "/images/products/chaveiro-react.png", altText: "Chaveiro React" },
    { url: "/images/products/chaveiro-javascript.png", altText: "Chaveiro JavaScript" },
    { url: "/images/products/chaveiro-typescript.png", altText: "Chaveiro TypeScript" },
    { url: "/images/products/chaveiro-terminal.png", altText: "Chaveiro Terminal" },
    { url: "/images/products/chaveiro-html-tags.png", altText: "Chaveiro HTML Tags" },
  ],
  "mousepad-focus": [
    { url: "/images/products/Mousepad-Focus.png", altText: "Mousepad Focus Desk Mat" },
  ],
  "moletom-focus-hoodie": [
    {
      url: "/images/products/Modelo-moletom-preto.webp",
      altText: "Modelo vestindo moletom Focus Streetwear preto",
    },
    {
      url: "/images/products/Moletom-preto-v2.png",
      altText: "Moletom Focus Streetwear preto",
    },
    {
      url: "/images/products/Modelo-moletom-Branco.webp",
      altText: "Modelo vestindo moletom Focus Streetwear branco",
    },
    {
      url: "/images/products/Moletom-focus-branco.png",
      altText: "Moletom Focus Streetwear branco",
    },
  ],
};

async function updateImages() {
  await prisma.$transaction(async (transaction) => {
    for (const [slug, images] of Object.entries(productImages)) {
      const product = await transaction.product.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!product) {
        throw new Error(`Produto não encontrado: ${slug}`);
      }

      const existingImages = await transaction.productImage.findMany({
        where: { productId: product.id },
        select: { id: true, position: true },
      });

      for (const [position, image] of images.entries()) {
        const data = {
          ...image,
          position,
          isPrimary: position === 0,
        };
        const existingImage = existingImages.find((item) => item.position === position);

        if (existingImage) {
          await transaction.productImage.update({
            where: { id: existingImage.id },
            data,
          });
        } else {
          await transaction.productImage.create({
            data: { ...data, productId: product.id },
          });
        }
      }

      console.log(`✓ Imagens atualizadas: ${slug}`);
    }
  });
}

updateImages()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
