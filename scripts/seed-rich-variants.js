const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPAREL_COLORS = [
  { name: 'Preto', code: 'BLK', hex: '#0D0D0D' },
  { name: 'Branco', code: 'WHT', hex: '#FFFFFF' },
];

const APPAREL_SIZES = ['PP', 'P', 'M', 'G', 'GG'];

async function seedRichVariants() {
  console.log('Seeding reduced variants (Preto e Branco / PP, P, M, G, GG)...');

  const apparelProducts = await prisma.product.findMany({
    where: {
      slug: { in: ['camisa-focus-lab', 'moletom-focus-lab'] },
    },
  });

  for (const product of apparelProducts) {
    console.log(`Updating variants for ${product.name} (${product.slug})...`);
    
    // Remove existing variants and their dependencies
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

    // Create combinations for Preto e Branco / PP, P, M, G, GG
    let pos = 0;
    for (const color of APPAREL_COLORS) {
      for (const size of APPAREL_SIZES) {
        const sku = `${product.sku}-${color.code}-${size}`;
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            name: `${product.name} - ${color.name} / ${size}`,
            sku,
            color: color.name,
            colorHex: color.hex,
            size: size,
            price: product.basePrice,
            promotionalPrice: product.promotionalPrice,
            position: pos++,
            inventory: {
              create: {
                quantityAvailable: Math.floor(Math.random() * 30) + 15,
                quantityReserved: 0,
              },
            },
          },
        });
      }
    }
    console.log(`✓ Created ${APPAREL_COLORS.length * APPAREL_SIZES.length} variants for ${product.name}`);
  }

  // Boné Focus Lab (Preto e Branco)
  const bone = await prisma.product.findUnique({ where: { slug: 'bone-focus-lab' } });
  if (bone) {
    const existingVariants = await prisma.productVariant.findMany({ where: { productId: bone.id }, select: { id: true } });
    for (const v of existingVariants) {
      await prisma.inventory.deleteMany({ where: { variantId: v.id } });
      await prisma.cartItem.deleteMany({ where: { variantId: v.id } });
      await prisma.orderItem.deleteMany({ where: { variantId: v.id } });
      await prisma.wishlistItem.deleteMany({ where: { variantId: v.id } });
    }
    await prisma.productVariant.deleteMany({ where: { productId: bone.id } });

    const boneColors = [
      { name: 'Preto', code: 'BLK', hex: '#0D0D0D' },
      { name: 'Branco', code: 'WHT', hex: '#FFFFFF' },
    ];

    for (let i = 0; i < boneColors.length; i++) {
      const c = boneColors[i];
      await prisma.productVariant.create({
        data: {
          productId: bone.id,
          name: `${bone.name} - ${c.name} / Único`,
          sku: `FS-CAP-${c.code}-U`,
          color: c.name,
          colorHex: c.hex,
          size: 'Único',
          price: bone.basePrice,
          position: i,
          inventory: {
            create: {
              quantityAvailable: 40,
              quantityReserved: 0,
            },
          },
        },
      });
    }
    console.log(`✓ Created ${boneColors.length} variants for ${bone.name}`);
  }

  console.log('✓ All product variants updated with Preto/Branco and PP, P, M, G, GG!');
}

seedRichVariants()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
