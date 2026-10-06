import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { CatalogPdfView } from '@/components/admin/catalog-pdf-view';

export const dynamic = 'force-dynamic';

export default async function CatalogPdfPage() {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: {
        where: { isActive: true },
        include: { inventory: true },
        orderBy: { position: 'asc' },
      },
      categories: { include: { category: true } },
      collections: { include: { collection: true } },
    },
    orderBy: [
      { categories: { _count: 'desc' } },
      { name: 'asc' },
    ],
  });

  return <CatalogPdfView products={products} />;
}
