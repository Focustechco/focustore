import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { CatalogPdfView } from '@/components/admin/catalog-pdf-view';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const dynamic = 'force-dynamic';

export default async function CatalogPdfPage() {
  let products: any[] = [];
  try {
    products = await prisma.product.findMany({
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
  } catch (err) {
    console.error('Error fetching products for PDF catalog:', err);
  }

  return <CatalogPdfView products={products} />;
}
