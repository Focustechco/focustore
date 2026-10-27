import { prisma } from '@/lib/db/prisma';

import { HIDDEN_PRODUCT_SLUGS } from './catalog-policy';

export class CatalogService {
  static async getCollections() {
    try {
      return await prisma.collection.findMany({
        where: { isActive: true },
        include: {
          products: {
            where: {
              product: { status: 'ACTIVE', slug: { notIn: HIDDEN_PRODUCT_SLUGS } },
            },
            include: {
              product: {
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
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching collections:');
      throw new Error('Catálogo temporariamente indisponível.');
    }
  }

  static async getCollectionBySlug(slug: string) {
    try {
      return await prisma.collection.findUnique({
        where: { slug, isActive: true },
        include: {
          products: {
            where: {
              product: { status: 'ACTIVE', slug: { notIn: HIDDEN_PRODUCT_SLUGS } },
            },
            include: {
              product: {
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
              },
            },
          },
        },
      });
    } catch (error) {
      console.error(`Error fetching collection ${slug}:`);
      throw new Error('Catálogo temporariamente indisponível.');
    }
  }

  static async getCategories() {
    try {
      return await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
        include: {
          _count: {
            select: {
              products: {
                where: {
                  product: { status: 'ACTIVE', slug: { notIn: HIDDEN_PRODUCT_SLUGS } },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching categories:');
      throw new Error('Catálogo temporariamente indisponível.');
    }
  }

  static async getCategoryBySlug(slug: string) {
    try {
      return await prisma.category.findUnique({
        where: { slug, isActive: true },
        include: {
          products: {
            where: {
              product: { status: 'ACTIVE', slug: { notIn: HIDDEN_PRODUCT_SLUGS } },
            },
            include: {
              product: {
                include: {
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
      console.error(`Error fetching category ${slug}:`);
      throw new Error('Catálogo temporariamente indisponível.');
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
          images: { orderBy: { position: 'asc' } },
          variants: {
            where: { isActive: true },
            include: { inventory: true },
            orderBy: { position: 'asc' },
          },
          categories: { include: { category: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });
    } catch (error) {
      console.error('Error fetching featured products:');
      throw new Error('Catálogo temporariamente indisponível.');
    }
  }

  static async getAllProducts(params?: {
    categorySlug?: string;
    search?: string;
    sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
    minPrice?: number;
    maxPrice?: number;
  }) {
    try {
      const { categorySlug, search, sortBy, minPrice, maxPrice } = params || {};

      const where: any = {
        status: 'ACTIVE',
        slug: { notIn: HIDDEN_PRODUCT_SLUGS },
      };

      if (categorySlug && categorySlug !== 'todos') {
        where.categories = {
          some: {
            category: { slug: categorySlug },
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

      let orderBy: any = { createdAt: 'desc' };
      if (sortBy === 'price_asc') orderBy = { basePrice: 'asc' };
      if (sortBy === 'price_desc') orderBy = { basePrice: 'desc' };
      if (sortBy === 'newest') orderBy = { createdAt: 'desc' };

      return await prisma.product.findMany({
        where,
        orderBy,
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
      });
    } catch (error) {
      console.error('Error fetching all products:');
      throw new Error('Catálogo temporariamente indisponível.');
    }
  }

  static async getProductBySlug(slug: string) {
    try {
      const product = await prisma.product.findUnique({
        where: { slug, status: 'ACTIVE' },
        include: {
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
      return product && !HIDDEN_PRODUCT_SLUGS.includes(product.slug)
        ? product
        : null;
    } catch (error) {
      console.error(`Error fetching product ${slug}:`);
      throw new Error('Catálogo temporariamente indisponível.');
    }
  }

  static async getRelatedProducts(productId: string, categoryId?: string) {
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
          images: { orderBy: { position: 'asc' } },
          variants: {
            where: { isActive: true },
            include: { inventory: true },
            orderBy: { position: 'asc' },
          },
        },
        take: 4,
      });
    } catch (error) {
      console.error(`Error fetching related products for ${productId}:`);
      throw new Error('Catálogo temporariamente indisponível.');
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
      console.error(`Error fetching banners for placement ${placement}:`);
      throw new Error('Catálogo temporariamente indisponível.');
    }
  }
}
