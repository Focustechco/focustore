"""Register all models before Alembic reads Base.metadata."""

from app.models.category import Category
from app.models.product import Product

__all__ = ["Category", "Product"]