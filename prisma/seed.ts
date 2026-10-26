import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEV_COLLECTION_COLORS = [
  { name: 'Preto', code: 'BLK', hex: '#0D0D0D' },
  { name: 'Branco', code: 'WHT', hex: '#FFFFFF' },
];
const DEV_COLLECTION_SIZES = ['PP', 'P', 'M', 'G', 'GG'];
const DEV_COLLECTION_STOCK = [25, 35, 50, 40, 20];

async function main() {
  console.log("--- Atualizando banco de dados com dados fieis ao mockup ---");

  await prisma.auditLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.couponUsage.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.collectionProduct.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.setting.deleteMany();

  const adminPassword = await bcrypt.hash("admin123", 10);
  const customerPassword = await bcrypt.hash("cliente123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin Focus",
      email: "admin@focusstore.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      phone: "(11) 99999-0000",
      cpf: "000.000.000-00",
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "Adrian Dev",
      email: "cliente@focusstore.com",
      passwordHash: customerPassword,
      role: "CUSTOMER",
      phone: "(11) 98765-4321",
      cpf: "123.456.789-00",
      addresses: {
        create: {
          recipientName: "Adrian Dev",
          street: "Avenida Paulista",
          number: "1000",
          complement: "Apto 1502",
          neighborhood: "Bela Vista",
          city: "Sao Paulo",
          state: "SP",
          postalCode: "01310-100",
          isDefault: true,
        },
      },
    },
  });

  // Categorias
  const catVestuario = await prisma.category.create({
    data: {
      name: "Vestuário",
      slug: "vestuario",
      description: "Camisas, moletons e peças em corte minimalista.",
      iconName: "Shirt",
      position: 1,
    },
  });

  const catAcessorios = await prisma.category.create({
    data: {
      name: "Acessórios",
      slug: "acessorios",
      description: "Bonés, chaveiros e itens essenciais.",
      iconName: "Headphones",
      position: 2,
    },
  });

  const catCasaEscritorio = await prisma.category.create({
    data: {
      name: "Casa e Escritório",
      slug: "casa-e-escritorio",
      description: "Canecas e garrafas térmicas.",
      iconName: "Coffee",
      position: 3,
    },
  });

  const catTecnologia = await prisma.category.create({
    data: {
      name: "Tecnologia",
      slug: "tecnologia",
      description: "Acessórios e gadgets.",
      iconName: "Smartphone",
      position: 4,
    },
  });

  const catKits = await prisma.category.create({
    data: {
      name: "Kits e Presentes",
      slug: "kits-e-presentes",
      description: "Combos e presentes especiais.",
      iconName: "Gift",
      position: 5,
    },
  });

  const catColecoes = await prisma.category.create({
    data: {
      name: "Coleções",
      slug: "colecoes",
      description: "Drops exclusivos Focus Lab.",
      iconName: "Star",
      position: 6,
    },
  });

  const catOfertas = await prisma.category.create({
    data: {
      name: "Ofertas",
      slug: "ofertas",
      description: "Produtos em promoção.",
      iconName: "Tag",
      position: 7,
    },
  });

  // Coleções
  const colFocusLab = await prisma.collection.create({
    data: {
      name: "Focus Lab",
      slug: "focus-lab",
      headline: "A essência do design minimalista",
      description: "Linha exclusiva desenvolvida para tecnologia e lifestyle.",
    },
  });

  const colDevCollection = await prisma.collection.create({
    data: {
      name: "DEV COLLECTION",
      slug: "dev-collection",
      headline: "Uma coleção para quem transforma ideias em código",
      description:
        "Camisas inspiradas nas principais linguagens de programação.",
    },
  });

  const devCollectionProducts = [
    {
      name: "Camisa Python",
      slug: "camisa-dev-collection-python",
      sku: "FS-AMS-TSHIRT-001",
      language: "Python",
      image: "/images/camisas/01_Python_original.png?v=20261026-2",
      whiteImage: "/images/camisas/camisa-python-branca.png?v=20261026-2",
      variantPrefix: "FS-AMS-TSHIRT",
    },
    {
      name: "Camisa Java",
      slug: "camisa-dev-collection-java",
      sku: "FS-AMS-POLO-001",
      language: "Java",
      image: "/images/camisas/02_Java_alta_resolucao.png?v=20261026-2",
      whiteImage: "/images/camisas/camisa-java-branca.png?v=20261026-2",
      variantPrefix: "FS-AMS-POLO",
    },
    {
      name: "Camisa JavaScript",
      slug: "camisa-dev-collection-javascript",
      sku: "FS-AMS-CAP-001",
      language: "JavaScript",
      image: "/images/camisas/05_JavaScript_original.png?v=20261026-2",
      whiteImage: "/images/camisas/camisa-js-branca.jfif?v=20261026-2",
      variantPrefix: "FS-AMS-CAP",
    },
    {
      name: "Camisa TypeScript",
      slug: "camisa-dev-collection-typescript",
      sku: "FS-DEV-TS-001",
      language: "TypeScript",
      image: "/images/camisas/03_TypeScript_alta_resolucao.png?v=20261026-2",
      whiteImage: "/images/camisas/camisa-ts-branca.png?v=20261026-2",
      variantPrefix: "FS-DEV-TS",
    },
  ];

  for (const [position, item] of devCollectionProducts.entries()) {
    await prisma.product.create({
      data: {
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        description: `Camisa ${item.language} da DEV COLLECTION, para quem transforma ideias em código.`,
        shortDescription: `Camisa ${item.language} da DEV COLLECTION.`,
        basePrice: 89.9,
        isFeatured: true,
        status: "ACTIVE",
        categories: {
          create: [
            { categoryId: catVestuario.id },
            { categoryId: catColecoes.id },
          ],
        },
        collections: {
          create: [{ collectionId: colDevCollection.id, position }],
        },
        images: {
          create: [
            { url: item.image, isPrimary: true, altText: `${item.name} - Preto` },
            { url: item.whiteImage, isPrimary: false, altText: `${item.name} - Branco` },
          ],
        },
        variants: {
          create: DEV_COLLECTION_COLORS.flatMap((color) =>
            DEV_COLLECTION_SIZES.map((size, index) => ({
              name: `${item.name} - ${color.name} / ${size}`,
              sku: `${item.variantPrefix}-${color.code}-${size}`,
              color: color.name,
              colorHex: color.hex,
              size,
              price: 89.9,
              position:
                DEV_COLLECTION_COLORS.indexOf(color) * DEV_COLLECTION_SIZES.length +
                index,
              inventory: {
                create: {
                  quantityAvailable: DEV_COLLECTION_STOCK[index],
                  quantityReserved: 0,
                },
              },
            })),
          ),
        },
      },
    });
  }

  // 1. Camisa Focus (R$ 89,90)
  await prisma.product.create({
    data: {
      name: "Camisa Focus",
      slug: "camisa-focus-lab",
      sku: "FS-TSHIRT-001",
      description:
        "100% Algodão Egípcio penteado, toque macio com caimento streetwear e logo Focus em destaque.",
      shortDescription:
        "100% Algodão Egípcio, toque ultra macio e corte moderno.",
      basePrice: 89.9,
      isFeatured: true,
      status: "ACTIVE",
      categories: { create: [{ categoryId: catVestuario.id }] },
      collections: { create: [{ collectionId: colFocusLab.id }] },
      images: {
        create: [
          {
            url: "/images/products/camisa-focus.jpg",
            isPrimary: true,
            altText: "Camisa Focus",
          },
        ],
      },
      variants: {
        create: [
          {
            name: "Camisa Focus - Preto / P",
            sku: "FS-TSHIRT-BLK-P",
            color: "Preto",
            colorHex: "#080808",
            size: "P",
            price: 89.9,
            inventory: {
              create: { quantityAvailable: 25, quantityReserved: 0 },
            },
          },
          {
            name: "Camisa Focus - Preto / M",
            sku: "FS-TSHIRT-BLK-M",
            color: "Preto",
            colorHex: "#080808",
            size: "M",
            price: 89.9,
            inventory: {
              create: { quantityAvailable: 50, quantityReserved: 0 },
            },
          },
          {
            name: "Camisa Focus - Preto / G",
            sku: "FS-TSHIRT-BLK-G",
            color: "Preto",
            colorHex: "#080808",
            size: "G",
            price: 89.9,
            inventory: {
              create: { quantityAvailable: 35, quantityReserved: 0 },
            },
          },
          {
            name: "Camisa Focus - Preto / GG",
            sku: "FS-TSHIRT-BLK-GG",
            color: "Preto",
            colorHex: "#080808",
            size: "GG",
            price: 89.9,
            inventory: {
              create: { quantityAvailable: 15, quantityReserved: 0 },
            },
          },
        ],
      },
    },
  });

  // 2. Polo Focus Tech (R$ 179,90)
  await prisma.product.create({
    data: {
      name: "Polo Focus Tech",
      slug: "moletom-focus-lab",
      sku: "FS-POLO-001",
      description:
        "Camisa polo premium em piquet de alta densidade com logo Focus termocolante.",
      shortDescription:
        "Piquet de alta densidade com caimento impecável e detalhes em Focus Orange.",
      basePrice: 179.9,
      isFeatured: true,
      status: "ACTIVE",
      categories: { create: [{ categoryId: catVestuario.id }] },
      collections: { create: [{ collectionId: colFocusLab.id }] },
      images: {
        create: [
          {
            url: "/images/products/polo-focus.jpg",
            isPrimary: true,
            altText: "Polo Focus Tech",
          },
        ],
      },
      variants: {
        create: [
          {
            name: "Polo Focus Tech - Preto / P",
            sku: "FS-POLO-BLK-P",
            color: "Preto",
            colorHex: "#080808",
            size: "P",
            price: 179.9,
            inventory: {
              create: { quantityAvailable: 20, quantityReserved: 0 },
            },
          },
          {
            name: "Polo Focus Tech - Preto / M",
            sku: "FS-POLO-BLK-M",
            color: "Preto",
            colorHex: "#080808",
            size: "M",
            price: 179.9,
            inventory: {
              create: { quantityAvailable: 40, quantityReserved: 0 },
            },
          },
          {
            name: "Polo Focus Tech - Preto / G",
            sku: "FS-POLO-BLK-G",
            color: "Preto",
            colorHex: "#080808",
            size: "G",
            price: 179.9,
            inventory: {
              create: { quantityAvailable: 30, quantityReserved: 0 },
            },
          },
        ],
      },
    },
  });

  // 3. Boné Focus Lab (R$ 79,90)
  await prisma.product.create({
    data: {
      name: "Boné Focus Lab",
      slug: "bone-focus-lab",
      sku: "FS-CAP-001",
      description:
        "Dad hat estruturado em sarja premium com fecho de metal e logo Focus bordado.",
      shortDescription:
        "Sarja premium estruturada com fecho de metal e bordado tonal.",
      basePrice: 79.9,
      isFeatured: true,
      status: "ACTIVE",
      categories: { create: [{ categoryId: catAcessorios.id }] },
      images: {
        create: [
          {
            url: "/images/products/bone-focus.jpg",
            isPrimary: true,
            altText: "Boné Focus Lab",
          },
        ],
      },
      variants: {
        create: [
          {
            name: "Boné Focus Lab - Preto / Único",
            sku: "FS-CAP-BLK-U",
            color: "Preto",
            colorHex: "#080808",
            size: "Único",
            price: 79.9,
            inventory: {
              create: { quantityAvailable: 60, quantityReserved: 0 },
            },
          },
          {
            name: "Boné Focus Lab - Laranja / Único",
            sku: "FS-CAP-ORG-U",
            color: "Laranja Focus",
            colorHex: "#FF6500",
            size: "Único",
            price: 79.9,
            inventory: {
              create: { quantityAvailable: 25, quantityReserved: 0 },
            },
          },
        ],
      },
    },
  });

  // 4. Garrafa Térmica Focus (R$ 129,90)
  await prisma.product.create({
    data: {
      name: "Garrafa Térmica Focus",
      slug: "garrafa-termica-focus",
      sku: "FS-BOTTLE-001",
      description:
        "Inox 18/8 com isolamento térmico a vácuo 24h gelado / 12h quente. 750ml.",
      shortDescription:
        "Inox 18/8 com isolamento térmico 24h gelado / 12h quente. 750ml.",
      basePrice: 129.9,
      isFeatured: true,
      status: "ACTIVE",
      categories: { create: [{ categoryId: catCasaEscritorio.id }] },
      images: {
        create: [
          {
            url: "/images/products/garrafa-focus.jpg",
            isPrimary: true,
            altText: "Garrafa Térmica Focus",
          },
        ],
      },
      variants: {
        create: [
          {
            name: "Garrafa Térmica Focus - Preto Fosco / 750ml",
            sku: "FS-BOTTLE-BLK-750",
            color: "Preto Fosco",
            colorHex: "#151515",
            size: "750ml",
            price: 129.9,
            inventory: {
              create: { quantityAvailable: 45, quantityReserved: 0 },
            },
          },
        ],
      },
    },
  });

  // 5. Chaveiro Focus (R$ 29,90)
  await prisma.product.create({
    data: {
      name: "Chaveiro Focus",
      slug: "chaveiro-focus",
      sku: "FS-KEYCHAIN-001",
      description:
        "Liga de zinco anodizado e pingente hexagonal laranja e preto com logo Focus.",
      shortDescription: "Liga de zinco anodizado e fita tática laranja Focus.",
      basePrice: 29.9,
      isFeatured: true,
      status: "ACTIVE",
      categories: { create: [{ categoryId: catAcessorios.id }] },
      images: {
        create: [
          {
            url: "/images/products/chaveiros-focus-kit.jpg",
            isPrimary: true,
            altText: "Chaveiros Focus",
          },
        ],
      },
      variants: {
        create: [
          {
            name: "Chaveiro Focus - Laranja & Preto",
            sku: "FS-KEYCHAIN-ORG",
            color: "Laranja Focus",
            colorHex: "#FF6500",
            size: "Único",
            price: 29.9,
            inventory: {
              create: { quantityAvailable: 100, quantityReserved: 0 },
            },
          },
        ],
      },
    },
  });

  // 6. Caneca Focus Lab (R$ 49,90)
  await prisma.product.create({
    data: {
      name: "Caneca Focus Lab",
      slug: "caneca-focus-lab",
      sku: "FS-MUG-001",
      description:
        "Cerâmica premium fosca vitrificada com interior laranja Focus. 350ml.",
      shortDescription:
        "Cerâmica premium fosca com interior laranja Focus. 350ml.",
      basePrice: 49.9,
      isFeatured: true,
      status: "ACTIVE",
      categories: { create: [{ categoryId: catCasaEscritorio.id }] },
      images: {
        create: [
          {
            url: "/images/products/caneca-focus.jpg",
            isPrimary: true,
            altText: "Caneca Focus Lab",
          },
        ],
      },
      variants: {
        create: [
          {
            name: "Caneca Focus Lab - Preto & Laranja / 350ml",
            sku: "FS-MUG-BLK-350",
            color: "Preto",
            colorHex: "#101010",
            size: "350ml",
            price: 49.9,
            inventory: {
              create: { quantityAvailable: 80, quantityReserved: 0 },
            },
          },
        ],
      },
    },
  });

  // Cupons
  await prisma.coupon.createMany({
    data: [
      {
        code: "FOCUS10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        usageLimit: 500,
        isActive: true,
      },
      {
        code: "BEMVINDO20",
        discountType: "FIXED_AMOUNT",
        discountValue: 20,
        minOrderAmount: 100,
        usageLimit: 1000,
        isActive: true,
      },
      {
        code: "FRETEGRATIS",
        discountType: "FREE_SHIPPING",
        discountValue: 0,
        minOrderAmount: 150,
        usageLimit: 200,
        isActive: true,
      },
    ],
  });

  console.log("✓ Produtos atualizados conforme o layout!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
