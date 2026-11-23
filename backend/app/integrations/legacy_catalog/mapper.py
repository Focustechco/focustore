"""Translate selected Prisma columns without mutating or persisting source data."""
from sqlite3 import Row

from app.schemas.catalog import CatalogCategory, CatalogImage, CatalogProduct, CatalogVariant
from app.schemas.catalog_money import money


def map_category(row: Row) -> CatalogCategory:
    return CatalogCategory(**dict(row))


def map_product(
    row: Row, images: list[Row], categories: list[Row], variants: list[Row]
) -> CatalogProduct:
    gallery = [CatalogImage(**dict(image)) for image in images]
    mapped_variants = []
    for variant in variants:
        data = dict(variant)
        data['price'] = money(data['price'])
        data['promotional_price'] = money(data['promotional_price'])
        data['available'] = (data['quantity_available'] or 0) > 0
        mapped_variants.append(CatalogVariant(**data))
    data = dict(row)
    data['base_price'] = money(data['base_price'])
    data['promotional_price'] = money(data['promotional_price'])
    return CatalogProduct(
        **data,
        catalog_origin='legacy_sqlite',
        images=gallery,
        primary_image=next((image for image in gallery if image.is_primary),
                           gallery[0] if gallery else None),
        categories=[map_category(category) for category in categories],
        variants=mapped_variants,
        available=any(variant.available for variant in mapped_variants),
    )
