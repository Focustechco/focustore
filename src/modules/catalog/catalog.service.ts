import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { FocusApiClient } from '@/lib/api/focus-api';
import {
  adaptCatalogCategory,
  adaptCatalogProduct,
  type StorefrontCategory,
  type StorefrontProduct,
} from './catalog-api.adapter';
import { HIDDEN_PRODUCT_SLUGS } from './catalog-policy';

type ProductFilters = {
  categorySlug?: string;
  search?: string;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  minPrice?: number;
  maxPrice?: number;
};

function catalogReadSource(): 'prisma' | 'fastapi' {
  const value = process.env.CATALOG_READ_SOURCE ?? 'prisma';
  if (value === 'prisma' || value === 'fastapi') return value;
  throw new Error('CATALOG_READ_SOURCE must be either "prisma" or "fastapi".');
}

function filterFastApiProducts(products: StorefrontProduct[], params: ProductFilters = {}): StorefrontProduct[] {
  const { categorySlug, search, sortBy, minPrice, maxPrice } = params;
  const query = search?.trim().toLocaleLowerCase();
  const filtered = products.filter(product => {
    if (HIDDEN_PRODUCT_SLUGS.includes(product.slug)) return false;
    if (categorySlug && categorySlug !== 'todos' && !product.categories.some(({ category }) => category.slug === categorySlug)) return false;
    if (query && ![product.name, product.description, product.brand].some(value => value.toLocaleLowerCase().includes(query))) return false;
    if (minPrice !== undefined && product.basePrice < minPrice) return false;
    return maxPrice === undefined || product.basePrice <= maxPrice;
  });
  if (sortBy === 'price_asc') return filtered.sort((a, b) => a.basePrice - b.basePrice);
  if (sortBy === 'price_desc') return filtered.sort((a, b) => b.basePrice - a.basePrice);
  // FastAPI deliberately omits createdAt, so its stable API order is retained for relevance/newest.
  return filtered;
}

export class CatalogService {
  static async getCollections() {
    try {
      return await prisma.collection.findMany({
        where: { isActive: true },
        include: {
          products: {
            where: {
              product: {
                status: 'ACTIVE',
                slug: { notIn: HIDDEN_PRODUCT_SLUGS },
              },
            },
            orderBy: { position: 'asc' },
            include: {
              product: {
                include: {
                  _count: { select: { reviews: { where: { isApproved: true } } } },
                  images: { orderBy: { position: 'asc' } },
                  variants: {
                    where: { isActive: true },
                    include: { inventory: true },
                    orderBy: { position: 'asc' },
                  },
                  categories: {
                    where: { category: { isActive: true } },
                    include: { category: true },
                  },
                  collections: {
                    where: { collection: { isActive: true } },
                    include: { collection: true },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching collections:', error);
      throw error;
    }
  }

  static async getCollectionBySlug(slug: string) {
    try {
      return await prisma.collection.findUnique({
        where: { slug, isActive: true },
        include: {
          products: {
            where: {
              product: {
                status: 'ACTIVE',
                slug: { notIn: HIDDEN_PRODUCT_SLUGS },
              },
            },
            orderBy: { position: 'asc' },
            include: {
              product: {
                include: {
                  _count: { select: { reviews: { where: { isApproved: true } } } },
                  images: { orderBy: { position: 'asc' } },
                  variants: {
                    where: { isActive: true },
                    include: { inventory: true },
                    orderBy: { position: 'asc' },
                  },
                  categories: {
                    where: { category: { isActive: true } },
                    include: { category: true },
                  },
                  collections: {
                    where: { collection: { isActive: true } },
                    include: { collection: true },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error(`Error fetching collection ${slug}:`, error);
      throw error;
    }
  }

  static async getCategories(): Promise<StorefrontCategory[]> {
    if (catalogReadSource() === 'fastapi') {
      return this.allFastApiPages((client, offset) => client.listCategories(offset)).then(page => page.map(adaptCatalogCategory));
    }
    try {
      return await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
        include: {
          _count: {
            select: {
              products: {
                where: {
                  product: {
                    status: 'ACTIVE',
                    slug: { notIn: HIDDEN_PRODUCT_SLUGS },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  static async getCategoryBySlug(slug: string): Promise<StorefrontCategory | null> {
    if (catalogReadSource() === 'fastapi') {
      const category = await new FocusApiClient().getCategory(slug);
      return category ? adaptCatalogCategory(category) : null;
    }
    try {
      return await prisma.category.findUnique({
        where: { slug, isActive: true },
        include: {
          products: {
            where: {
              product: {
                status: 'ACTIVE',
                slug: { notIn: HIDDEN_PRODUCT_SLUGS },
              },
            },
            include: {
              product: {
                include: {
                  _count: { select: { reviews: { where: { isApproved: true } } } },
                  images: { orderBy: { position: 'asc' } },
                  variants: {
                    where: { isActive: true },
                    include: { inventory: true },
                    orderBy: { position: 'asc' },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error(`Error fetching category ${slug}:`, error);
      throw error;
    }
  }

  static async getFeaturedProducts() {
    try {
      return await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          isFeatured: true,
          slug: { notIn: HIDDEN_PRODUCT_SLUGS },
        },
        include: {
          _count: { select: { reviews: { where: { isApproved: true } } } },
          images: { orderBy: { position: 'asc' } },
          variants: {
            where: { isActive: true },
            include: { inventory: true },
            orderBy: { position: 'asc' },
          },
          categories: {
            where: { category: { isActive: true } },
            include: { category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });
    } catch (error) {
      console.error('Error fetching featured products:', error);
      throw error;
    }
  }

  static async getAllProducts(params?: ProductFilters): Promise<StorefrontProduct[]> {
    if (catalogReadSource() === 'fastapi') {
      const products = await this.allFastApiPages((client, offset) => client.listProducts(offset, 100, params));
      return filterFastApiProducts(products.map(adaptCatalogProduct), params);
    }
    return this.getAllProductsFromPrisma(params);
  }

  /** Prisma-only read for collection pages; FastAPI does not expose collections yet. */
  static async getAllProductsFromPrisma(params?: ProductFilters) {
    try {
      const { categorySlug, search, sortBy, minPrice, maxPrice } = params || {};

      const where: Prisma.ProductWhereInput = {
        status: 'ACTIVE',
        slug: { notIn: HIDDEN_PRODUCT_SLUGS },
      };

      if (categorySlug && categorySlug !== 'todos') {
        where.categories = {
          some: {
            category: { slug: categorySlug, isActive: true },
          },
        };
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { brand: { contains: search } },
        ];
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.basePrice = {};
        if (minPrice !== undefined) where.basePrice.gte = minPrice;
        if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
      }

      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
      if (sortBy === 'price_asc') orderBy = { basePrice: 'asc' };
      if (sortBy === 'price_desc') orderBy = { basePrice: 'desc' };
      if (sortBy === 'newest') orderBy = { createdAt: 'desc' };

      return await prisma.product.findMany({
        where,
        orderBy,
        include: {
          _count: { select: { reviews: { where: { isApproved: true } } } },
          images: { orderBy: { position: 'asc' } },
          variants: {
            where: { isActive: true },
            include: { inventory: true },
            orderBy: { position: 'asc' },
          },
          categories: { include: { category: true } },
          collections: { include: { collection: true } },
        },
      });
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw error;
    }
  }

  static async getProductBySlug(slug: string): Promise<StorefrontProduct | null> {
    if (catalogReadSource() === 'fastapi') {
      const product = await new FocusApiClient().getProduct(slug);
      return product ? adaptCatalogProduct(product) : null;
    }
    try {
      const product = await prisma.product.findUnique({
        where: {
          slug,
          status: 'ACTIVE',
          AND: [{ slug: { notIn: HIDDEN_PRODUCT_SLUGS } }],
        },
        include: {
          _count: { select: { reviews: { where: { isApproved: true } } } },
          images: { orderBy: { position: 'asc' } },
          variants: {
            where: { isActive: true },
            include: { inventory: true },
            orderBy: { position: 'asc' },
          },
          categories: { include: { category: true } },
          reviews: {
            where: { isApproved: true },
            include: { user: { select: { name: true, image: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      return product;
    } catch (error) {
      console.error(`Error fetching product ${slug}:`, error);
      throw error;
    }
  }

  static async getRelatedProducts(productId: string, categoryId?: string): Promise<StorefrontProduct[]> {
    if (catalogReadSource() === 'fastapi') {
      const products = await this.allFastApiPages((client, offset) => client.listProducts(offset));
      return products.map(adaptCatalogProduct)
        .filter(product => product.id !== productId && !HIDDEN_PRODUCT_SLUGS.includes(product.slug))
        .filter(product => !categoryId || product.categories.some(category => category.categoryId === categoryId))
        .slice(0, 4);
    }
    try {
      return await prisma.product.findMany({
        where: {
          id: { not: productId },
          status: 'ACTIVE',
          slug: { notIn: HIDDEN_PRODUCT_SLUGS },
          ...(categoryId
            ? { categories: { some: { categoryId } } }
            : {}),
        },
        include: {
          _count: { select: { reviews: { where: { isApproved: true } } } },
          images: { orderBy: { position: 'asc' } },
          variants: {
            where: { isActive: true },
            include: { inventory: true },
            orderBy: { position: 'asc' },
          },
          categories: { include: { category: true } },
        },
        take: 4,
      });
    } catch (error) {
      console.error(`Error fetching related products for ${productId}:`, error);
      throw error;
    }
  }

  static async getBanners(placement?: string) {
    try {
      return await prisma.banner.findMany({
        where: {
          isActive: true,
          ...(placement ? { placement } : {}),
        },
        orderBy: { position: 'asc' },
      });
    } catch (error) {
      console.error(`Error fetching banners for placement ${placement}:`, error);
      throw error;
    }
  }

  private static async allFastApiPages<T>(readPage: (client: FocusApiClient, offset: number) => Promise<{ items: T[]; total: number; offset: number; limit: number }>): Promise<T[]> {
    const client = new FocusApiClient();
    const items: T[] = [];
    let offset = 0;
    do {
      const page = await readPage(client, offset);
      items.push(...page.items);
      offset += page.items.length;
      if (page.items.length === 0 || offset >= page.total) break;
    } while (true);
    return items;
  }
}
