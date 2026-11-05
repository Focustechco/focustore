const { PrismaClient } = require('@prisma/client');
const { assertDemoSeed } = require('./seed-safety.cjs');
const prisma = new PrismaClient();

const HERO_BANNERS = [
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

const FEATURED_BANNERS = [
  {
    title: "KITS E\nPRESENTES",
    subtitle: "Para quem pensa diferente.",
    ctaText: "Ver kits",
    ctaLink: "/categoria/kits-e-presentes",
    imageUrl: "/images/banners/kits-presentes-banner.png",
    position: 0,
    placement: "home_featured",
    isActive: true,
  },
  {
    title: "PRODUTOS\nEXCLUSIVOS",
    subtitle: "Design que inspira.",
    ctaText: "Explorar",
    ctaLink: "/colecao/focus-lab",
    imageUrl: "/images/banners/produtos-exclusivos-banner.png",
    position: 1,
    placement: "home_featured",
    isActive: true,
  },
  {
    title: "FAÇA PARTE\nDO MOVIMENTO",
    subtitle: "Mais que uma loja, um movimento.",
    ctaText: "Saiba mais",
    ctaLink: "/colecao/focus-academy",
    imageUrl: "/images/banners/faca-parte-movimento.png",
    position: 2,
    placement: "home_featured",
    isActive: true,
  },
];

const REAL_LIFE_BANNERS = [
  {
    title: "@team.focus",
    subtitle: "Camisa Focus Classic Black",
    ctaText: "Ver no Instagram",
    ctaLink: "https://instagram.com/focus.store",
    imageUrl: "/images/community/real-team-duo.jpg",
    position: 0,
    placement: "home_real_life",
    isActive: true,
  },
  {
    title: "@focus.techcrew",
    subtitle: "Camisa Focus Oficial & Drop Summit",
    ctaText: "Ver no Instagram",
    ctaLink: "https://instagram.com/focus.store",
    imageUrl: "/images/community/real-team-booth.jpg",
    position: 1,
    placement: "home_real_life",
    isActive: true,
  },
  {
    title: "@raul.tech",
    subtitle: "Camisa Focus Oficial Tech Summit",
    ctaText: "Ver no Instagram",
    ctaLink: "https://instagram.com/focus.store",
    imageUrl: "/images/community/real-event-attendee.jpg",
    position: 2,
    placement: "home_real_life",
    isActive: true,
  },
  {
    title: "@felipe.creator",
    subtitle: "Camisa Focus Classic Black",
    ctaText: "Ver no Instagram",
    ctaLink: "https://instagram.com/focus.store",
    imageUrl: "/images/community/real-event-tripod.jpg",
    position: 3,
    placement: "home_real_life",
    isActive: true,
  },
  {
    title: "@joao.dev",
    subtitle: "Camisa Focus & Caderno Focus",
    ctaText: "Ver no Instagram",
    ctaLink: "https://instagram.com/focus.store",
    imageUrl: "/images/community/real-office-desk.jpg",
    position: 4,
    placement: "home_real_life",
    isActive: true,
  },
];

const DEFAULT_BANNERS = [
  ...HERO_BANNERS,
  ...FEATURED_BANNERS,
  ...REAL_LIFE_BANNERS,
];

async function seedBanners() {
  assertDemoSeed();
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
