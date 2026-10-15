import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { ProductForm } from '@/components/admin/product-form';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  let categories: any[] = [];
  let collections: any[] = [];

  try {
    const res = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
      }),
      prisma.collection.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    categories = res[0];
    collections = res[1];
  } catch (err) {
    console.error('Error fetching categories and collections for new product:', err);
  }

  return (
    <ProductForm
      categories={categories}
      collections={collections}
      isEditing={false}
    />
  );
}
