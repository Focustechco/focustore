import { prisma } from '@/lib/db/prisma';

export class CatalogService {
  static async getCollections() {
    return prisma.collection.findMany({
      include: {
        products: {
          include: {
            product: {
              include: {
                images: { orderBy: { position: 'asc' } },
                variants: { include: { inventory: true } },
                categories: { include: { category: true } },
                collections: { include: { collection: true } },
              },
            },
          },
        },
      },
    });
  }

  static async getCollectionBySlug(slug: string) {
    return prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: { orderBy: { position: 'asc' } },
                variants: { include: { inventory: true } },
                categories: { include: { category: true } },
                collections: { include: { collection: true } },
              },
            },
          },
        },
      },
    });
  }

  static async getCategories() {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  static async getCategoryBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: { orderBy: { position: 'asc' } },
                variants: { include: { inventory: true } },
              },
            },
          },
        },
      },
    });
  }

  static async getFeaturedProducts() {
    return prisma.product.findMany({
      where: { status: 'ACTIVE', isFeatured: true },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: { include: { inventory: true } },
        categories: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
  }

  static async getAllProducts(params?: {
    categorySlug?: string;
    search?: string;
    sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
    minPrice?: number;
    maxPrice?: number;
  }) {
    const { categorySlug, search, sortBy, minPrice, maxPrice } = params || {};

    const where: any = { status: 'ACTIVE' };

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

    return prisma.product.findMany({
      where,
      orderBy,
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: { include: { inventory: true } },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
      },
    });
  }

  static async getProductBySlug(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: {
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
  }

  static async getRelatedProducts(productId: string, categoryId?: string) {
    return prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'ACTIVE',
        ...(categoryId
          ? { categories: { some: { categoryId } } }
          : {}),
      },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: { include: { inventory: true } },
      },
      take: 4,
    });
  }

  static async getBanners(placement?: string) {
    return prisma.banner.findMany({
      where: {
        isActive: true,
        ...(placement ? { placement } : {}),
      },
      orderBy: { position: 'asc' },
    });
  }
}