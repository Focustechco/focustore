const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedCustomers() {
  console.log('Seeding customer accounts with orders...');

  // Customer 1: Lucas Techwear
  let lucas = await prisma.user.findUnique({ where: { email: 'lucas.tech@gmail.com' } });
  if (!lucas) {
    lucas = await prisma.user.create({
      data: {
        name: 'Lucas Ferreira (Techwear Dev)',
        email: 'lucas.tech@gmail.com',
        phone: '(11) 97123-4567',
        cpf: '345.678.901-22',
        role: 'CUSTOMER',
        addresses: {
          create: {
            recipientName: 'Lucas Ferreira',
            street: 'Av. Paulista',
            number: '1000',
            complement: 'Apto 142',
            neighborhood: 'Bela Vista',
            city: 'São Paulo',
            state: 'SP',
            postalCode: '01310-100',
            isDefault: true,
          },
        },
      },
    });

    // Create an order for Lucas
    const order1 = await prisma.order.create({
      data: {
        orderNumber: 'FS-ORD-2026-001',
        userId: lucas.id,
        subtotal: 389.80,
        shippingAmount: 0.0,
        discountAmount: 38.98,
        total: 350.82,
        status: 'PAID',
        shippingStreet: 'Av. Paulista',
        shippingNumber: '1000',
        shippingNeighborhood: 'Bela Vista',
        shippingCity: 'São Paulo',
        shippingState: 'SP',
        shippingPostalCode: '01310-100',
      },
    });
    console.log('Created customer Lucas with order');
  }

  // Customer 2: Mariana Cyber
  let mariana = await prisma.user.findUnique({ where: { email: 'mariana.silva@cyber.io' } });
  if (!mariana) {
    mariana = await prisma.user.create({
      data: {
        name: 'Mariana Silva',
        email: 'mariana.silva@cyber.io',
        phone: '(21) 98888-1122',
        cpf: '567.890.123-44',
        role: 'CUSTOMER',
        addresses: {
          create: {
            recipientName: 'Mariana Silva',
            street: 'Rua Visconde de Pirajá',
            number: '550',
            neighborhood: 'Ipanema',
            city: 'Rio de Janeiro',
            state: 'RJ',
            postalCode: '22410-002',
            isDefault: true,
          },
        },
      },
    });

    // Create an order for Mariana
    await prisma.order.create({
      data: {
        orderNumber: 'FS-ORD-2026-002',
        userId: mariana.id,
        subtotal: 519.70,
        shippingAmount: 25.0,
        discountAmount: 0.0,
        total: 544.70,
        status: 'DELIVERED',
        shippingStreet: 'Rua Visconde de Pirajá',
        shippingNumber: '550',
        shippingNeighborhood: 'Ipanema',
        shippingCity: 'Rio de Janeiro',
        shippingState: 'RJ',
        shippingPostalCode: '22410-002',
      },
    });
    console.log('Created customer Mariana with order');
  }

  console.log('Finished seeding customers.');
}

seedCustomers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
