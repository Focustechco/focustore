require('./seed-safety.cjs').assertDemoSeed();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateImages() {
  const updates = [
    { slug: 'caneca-focus-lab', url: '/images/products/caneca-focus.jpg' },
    { slug: 'bone-focus-lab', url: '/images/products/bone-focus.jpg' },
    { slug: 'camisa-focus-lab', name: 'Camisa Focus', url: '/images/products/camiseta-focus.jpg' },
    { slug: 'moletom-focus-lab', name: 'Polo Focus Tech', url: '/images/products/polo-focus.jpg' },
    { slug: 'garrafa-termica-focus', name: 'Garrafa Térmica Focus', url: '/images/products/garrafa-focus.jpg' },
    { slug: 'chaveiro-focus', name: 'Chaveiro Focus', url: '/images/products/chaveiros-focus-kit.jpg' },
  ];

  for (const item of updates) {
    const p = await prisma.product.findUnique({ where: { slug: item.slug } });
    if (p) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          name: item.name || p.name,
        }
      });
      await prisma.productImage.deleteMany({ where: { productId: p.id } });
      await prisma.productImage.create({
        data: {
          productId: p.id,
          url: item.url,
          isPrimary: true,
          altText: item.name || p.name,
        }
      });
      console.log('✓ Atualizado:', item.slug, '-> Nome:', item.name || p.name);
    }
  }
}

updateImages()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });