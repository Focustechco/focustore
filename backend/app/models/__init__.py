"""Register all models before Alembic reads Base.metadata."""

from app.models.category import Category
from app.models.product import (
    Inventory, InventoryMovement, Product, ProductCategory, ProductImage, ProductVariant,
    StockReservation, StockReservationItem,
)
from app.models.catalog_mapping import CatalogMappingEvent, CatalogVariantMapping

__all__ = [
    "CatalogMappingEvent",
    "CatalogVariantMapping",
    "Category",
    "Inventory",
    "InventoryMovement",
    "Product",
    "ProductCategory",
    "ProductImage",
    "ProductVariant",
    "StockReservation",
    "StockReservationItem",
]
