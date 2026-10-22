"""Register all models before Alembic reads Base.metadata."""
from app.models.category import Category

__all__ = ["Category"]
