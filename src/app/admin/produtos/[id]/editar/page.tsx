import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { ProductForm } from '@/components/admin/product-form';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, collections] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: {
          include: { inventory: true },
          orderBy: { position: 'asc' },
        },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    }),
    prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <ProductForm
      initialProduct={product}
      categories={categories}
      collections={collections}
      isEditing={true}
    />
  );
}
