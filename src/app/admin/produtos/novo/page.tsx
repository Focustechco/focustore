import { requireAdminPage } from '@/lib/auth/admin';
import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireAdminPage();
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
