"""Register all models before Alembic reads Base.metadata."""

from app.models.category import Category
from app.models.product import Inventory, Product, ProductCategory, ProductImage, ProductVariant

__all__ = [
    "Category",
    "Inventory",
    "Product",
    "ProductCategory",
    "ProductImage",
    "ProductVariant",
]
