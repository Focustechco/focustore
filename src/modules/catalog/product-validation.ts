type ProductVariantInput = {
  id?: string;
  name?: string;
  sku?: string;
  color?: string;
  colorHex?: string;
  size?: string;
  model?: string;
  price?: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  stock?: number;
  quantityAvailable?: number;
  isActive?: boolean;
};

type ProductInput = {
  name: string;
  slug?: string;
  sku: string;
  description?: string;
  shortDescription?: string | null;
  brand?: string;
  basePrice: number;
  promotionalPrice?: number | null;
  costPrice?: number | null;
  status?: string;
  isFeatured?: boolean;
  weightGrams?: number;
  heightCm?: number;
  widthCm?: number;
  lengthCm?: number;
  categoryIds?: string[];
  collectionIds?: string[];
  images?: Array<string | { url: string; altText?: string | null }>;
  variants?: ProductVariantInput[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, field: string, maxLength = 5000): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new Error(`${field} inválido.`);
  }
  return value.trim() || undefined;
}

function optionalPrice(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field} deve ser um valor não negativo.`);
  return number;
}

function optionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${field} deve ser um inteiro não negativo.`);
  return number;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${field} inválido.`);
  return value;
}

function stringIds(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error(`${field} inválidos.`);
  }
  return [...new Set(value.map((id: string) => id.trim()))];
}

function safeImageUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Imagem inválida.');
  const url = value.trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    if (new URL(url).protocol === 'https:') return url;
  } catch {
    // The value is not an absolute URL; reject it below.
  }
  throw new Error('Imagens devem usar um caminho local ou HTTPS.');
}

export function validatePromotionalPrice(
  basePrice: number,
  promotionalPrice: number | null | undefined,
): void {
  if (
    !Number.isFinite(basePrice) ||
    basePrice < 0 ||
    (promotionalPrice !== undefined &&
      promotionalPrice !== null &&
      (!Number.isFinite(promotionalPrice) ||
        promotionalPrice < 0 ||
        promotionalPrice >= basePrice))
  ) {
    throw new Error('O preço promocional deve ser menor que o preço base.');
  }
}

export function validateProductInput(value: unknown): ProductInput {
  if (!isRecord(value)) throw new Error('Dados do produto inválidos.');

  const name = optionalText(value.name, 'Nome', 200);
  const sku = optionalText(value.sku, 'SKU', 100);
  const basePrice = optionalPrice(value.basePrice, 'Preço base');
  if (!name || !sku || basePrice === undefined) {
    throw new Error('Nome, SKU e preço base são obrigatórios.');
  }

  const promotionalPrice = optionalPrice(value.promotionalPrice, 'Preço promocional');
  validatePromotionalPrice(basePrice, promotionalPrice);

  const variants = value.variants === undefined
    ? undefined
    : (() => {
        if (!Array.isArray(value.variants)) throw new Error('Variantes inválidas.');
        return value.variants.map((raw, index): ProductVariantInput => {
          if (!isRecord(raw)) throw new Error(`Variante ${index + 1} inválida.`);

          const price = optionalPrice(raw.price, `Preço da variante ${index + 1}`);
          const variantPromotionalPrice = optionalPrice(
            raw.promotionalPrice,
            `Preço promocional da variante ${index + 1}`,
          );
          validatePromotionalPrice(price ?? basePrice, variantPromotionalPrice);

          const stock = optionalInteger(raw.stock ?? raw.quantityAvailable, 'Estoque');
          const imageUrl = raw.imageUrl === undefined
            ? undefined
            : raw.imageUrl === null || raw.imageUrl === ''
              ? null
              : safeImageUrl(raw.imageUrl);
          const colorHex = optionalText(raw.colorHex, 'Cor', 7);
          if (colorHex && !/^#[\da-f]{6}$/i.test(colorHex)) throw new Error('Código hexadecimal de cor inválido.');

          return {
            id: optionalText(raw.id, 'Identificador da variante', 100),
            name: optionalText(raw.name, 'Nome da variante', 200),
            sku: optionalText(raw.sku, 'SKU da variante', 100),
            color: optionalText(raw.color, 'Cor', 100),
            colorHex,
            size: optionalText(raw.size, 'Tamanho', 50),
            model: optionalText(raw.model, 'Modelo', 100),
            price,
            promotionalPrice: variantPromotionalPrice,
            imageUrl,
            stock,
            isActive: optionalBoolean(raw.isActive, 'Status da variante'),
          };
        });
      })();

  const images = value.images === undefined
    ? undefined
    : (() => {
        if (!Array.isArray(value.images)) throw new Error('Imagens inválidas.');
        return value.images.map((image): string | { url: string; altText?: string | null } => {
          if (typeof image === 'string') return safeImageUrl(image);
          if (!isRecord(image)) throw new Error('Imagem inválida.');
          return {
            url: safeImageUrl(image.url),
            altText: optionalText(image.altText, 'Texto alternativo', 300) ?? null,
          };
        });
      })();

  const status = optionalText(value.status, 'Status', 20);
  if (status && !['ACTIVE', 'DRAFT', 'ARCHIVED'].includes(status)) {
    throw new Error('Status do produto inválido.');
  }

  return {
    name,
    slug: optionalText(value.slug, 'Slug', 200),
    sku,
    description: optionalText(value.description, 'Descrição', 20000),
    shortDescription: optionalText(value.shortDescription, 'Descrição curta', 1000) ?? null,
    brand: optionalText(value.brand, 'Marca', 100),
    basePrice,
    promotionalPrice: promotionalPrice ?? null,
    costPrice: optionalPrice(value.costPrice, 'Preço de custo') ?? null,
    status,
    isFeatured: optionalBoolean(value.isFeatured, 'Produto em destaque'),
    weightGrams: optionalInteger(value.weightGrams, 'Peso'),
    heightCm: optionalInteger(value.heightCm, 'Altura'),
    widthCm: optionalInteger(value.widthCm, 'Largura'),
    lengthCm: optionalInteger(value.lengthCm, 'Comprimento'),
    categoryIds: stringIds(value.categoryIds, 'Categorias'),
    collectionIds: stringIds(value.collectionIds, 'Coleções'),
    images,
    variants,
  };
}
