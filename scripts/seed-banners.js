require("./seed-safety.cjs").assertDemoSeed();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEFAULT_BANNERS = [
  {
    title: "IDEIAS TAMBÉM\nSE USAM.",
    subtitle:
      "Linha exclusiva desenvolvida para quem vive tecnologia, criatividade e inovação. Tecidos de alta gramatura e corte moderno.",
    ctaText: "Ver coleção",
    ctaLink: "/categoria/vestuario",
    imageUrl: "/images/hero/hero-focus-academy-banner-2026.png",
    position: 0,
    placement: "home_hero",
    isActive: true,
  },
  {
    title: "EXPRESSE SUA\nLINGUAGEM.",
    subtitle:
      "Conheça a Dev Collection da Focus Academy. Camisetas exclusivas inspiradas na programação, com estilo, tecnologia e personalidade.",
    ctaText: "Explorar coleção",
    ctaLink: "/colecao/dev-collection",
    imageUrl: "/images/banners/banner-camisas-dev.png",
    position: 0,
    placement: "home_hero",
    isActive: true,
  },
  {
    title: "FAÇA PARTE DO\nMOVIMENTO.",
    subtitle:
      "Camisas, moletons e polos exclusivas para quem respira tecnologia. Garanta suas peças com 10% OFF no PIX pelo cupom FOCUS10.",
    ctaText: "Ver Coleção",
    ctaLink: "/categoria/vestuario",
    imageUrl: "/images/hero/hero-movimento-streetwear.png",
    position: 2,
    placement: "home_hero",
    isActive: true,
  },
];

async function seedBanners() {
  console.log("Seeding default banners in database...");
  for (const banner of DEFAULT_BANNERS) {
    const existing = await prisma.banner.findFirst({
      where: {
        placement: banner.placement,
        ...(banner.position === 1
          ? {
              OR: [
                { imageUrl: "/images/hero/hero-tech-office.jpg" },
                { imageUrl: banner.imageUrl },
              ],
            }
          : { imageUrl: banner.imageUrl }),
      },
    });

    if (!existing) {
      await prisma.banner.create({
        data: banner,
      });
      console.log(`Created banner: ${banner.title.replace("\n", " ")}`);
    } else if (banner.position === 1) {
      await prisma.banner.update({
        where: { id: existing.id },
        data: banner,
      });
      console.log(`Updated banner: ${banner.title.replace("\n", " ")}`);
    } else {
      console.log(`Banner already exists: ${banner.title.replace("\n", " ")}`);
    }
  }
  console.log("Banners seed finished successfully.");
}

seedBanners()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
