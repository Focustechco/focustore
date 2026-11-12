"""Register all models before Alembic reads Base.metadata."""

from app.models.category import Category
from app.models.product import Inventory, Product, ProductCategory, ProductImage, ProductVariant
from app.models.catalog_mapping import CatalogMappingEvent, CatalogVariantMapping

__all__ = [
    "CatalogMappingEvent",
    "CatalogVariantMapping",
    "Category",
    "Inventory",
    "Product",
    "ProductCategory",
    "ProductImage",
    "ProductVariant",
]
