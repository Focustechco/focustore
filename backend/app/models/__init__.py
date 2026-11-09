"""Register all models before Alembic reads Base.metadata."""

from app.models.category import Category
from app.models.product import Inventory, Product, ProductCategory, ProductImage, ProductVariant
from app.models.user import AuthRateLimit, User, UserSession
from app.models.order import Order, OrderItem

__all__ = [
    "AuthRateLimit",
    "Category",
    "Inventory",
    "Product",
    "ProductCategory",
    "ProductImage",
    "ProductVariant",
    "User",
    "UserSession",
    "Order",
    "OrderItem",
]
