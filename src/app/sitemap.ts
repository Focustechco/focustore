import { MetadataRoute } from 'next';
import { CatalogService } from '@/modules/catalog/catalog.service';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://focusstore.com';

  let products: Awaited<ReturnType<typeof CatalogService.getAllProducts>> = [];
  let categories: Awaited<ReturnType<typeof CatalogService.getCategories>> = [];
  try {
    products = await CatalogService.getAllProducts();
  } catch {
    products = [];
  }
  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/produto/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  try {
    categories = await CatalogService.getCategories();
  } catch {
    categories = [];
  }
  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${baseUrl}/categoria/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...categoryEntries,
    ...productEntries,
  ];
}