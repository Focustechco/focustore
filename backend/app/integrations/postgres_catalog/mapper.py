from app.models.product import Product, ProductVariant
from app.schemas.catalog import CatalogCategory, CatalogImage, CatalogProduct, CatalogVariant as CatalogVariantSchema


def category_schema(category) -> CatalogCategory:
    return CatalogCategory(
        id=str(category.id),
        name=category.name,
        slug=category.slug,
        description=category.description,
        image_url=category.image_url,
        parent_id=str(category.parent_id) if category.parent_id is not None else None,
        position=category.position,
    )


def variant_schema(variant: ProductVariant) -> CatalogVariantSchema:
    inventory = variant.inventory
    available = inventory is not None and inventory.quantity_available > 0
    return CatalogVariantSchema(
        id=str(variant.id),
        public_id=variant.public_id,
        sku=variant.sku,
        name=variant.name,
        color=variant.color,
        color_hex=variant.color_hex,
        size=variant.size,
        model=variant.model,
        price=variant.price,
        promotional_price=variant.promotional_price,
        image_url=variant.image_url,
        position=variant.position,
        quantity_available=inventory.quantity_available if inventory else None,
        quantity_reserved=inventory.quantity_reserved if inventory else None,
        available=available,
    )


def product_schema(product: Product) -> CatalogProduct:
    images = [
        CatalogImage(
            id=str(image.id),
            url=image.url,
            alt_text=image.alt_text,
            position=image.position,
            is_primary=image.is_primary,
        )
        for image in product.images
    ]
    categories = list(product.categories)
    if not categories and product.category is not None:
        categories = [product.category]

    variants = [variant_schema(variant) for variant in product.variants if variant.is_active]
    return CatalogProduct(
        id=str(product.id),
        public_id=product.public_id,
        name=product.name,
        slug=product.slug or f'legacy-product-{product.id}',
        sku=product.sku or f'LEGACY-{product.id}',
        description=product.description or '',
        short_description=product.short_description,
        brand=product.brand,
        status=product.status,
        base_price=product.base_price if product.base_price is not None else product.price,
        promotional_price=product.promotional_price,
        available=any(variant.available for variant in variants),
        primary_image=next((image for image in images if image.is_primary), images[0] if images else None),
        images=images,
        categories=[category_schema(category) for category in categories if category.is_active],
        variants=variants,
    )
