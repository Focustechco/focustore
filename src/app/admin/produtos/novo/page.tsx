import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const [categories, collections] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    }),
    prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <ProductForm
      categories={categories}
      collections={collections}
      isEditing={false}
    />
  );
}
