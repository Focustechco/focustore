"""Insert deterministic, synthetic PostgreSQL catalog data for the E2E suite."""

import json
import os
import sys
from decimal import Decimal

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Inventory, Product, ProductCategory, ProductImage, ProductVariant


def main() -> None:
    database_url = os.environ["DATABASE_URL"]
    engine = create_engine(database_url, pool_pre_ping=True, hide_parameters=True)
    category = Category(
        name="Homologação Catálogo",
        slug="homolog-catalog",
        description="Categoria sintética da homologação",
        image_url="/images/homolog-category.png",
        position=1,
        is_active=True,
    )
    bottle = Product(
        name="Homolog Bottle",
        slug="homolog-bottle",
        sku="HOMOLOG-BOTTLE",
        description="Produto sintético com estoque e promoção zero",
        short_description="Garrafa sintética",
        brand="Focus E2E",
        price=Decimal("89.90"),
        base_price=Decimal("89.90"),
        promotional_price=Decimal("0.00"),
        stock=5,
        category=category,
        status="ACTIVE",
        is_featured=False,
    )
    shirt = Product(
        name="Homolog Shirt",
        slug="homolog-shirt",
        sku="HOMOLOG-SHIRT",
        description="Produto sintético sem estoque e sem imagem",
        short_description="Camisa sintética",
        brand="Focus E2E",
        price=Decimal("129.90"),
        base_price=Decimal("129.90"),
        promotional_price=Decimal("99.90"),
        stock=0,
        category=category,
        status="ACTIVE",
        is_featured=False,
    )
    inactive = Product(
        name="Homolog Inactive",
        slug="homolog-inactive",
        sku="HOMOLOG-INACTIVE",
        description="Nunca deve aparecer no catálogo público",
        brand="Focus E2E",
        price=Decimal("19.90"),
        base_price=Decimal("19.90"),
        stock=10,
        category=category,
        status="ARCHIVED",
        is_featured=False,
    )

    with Session(engine) as session:
        existing_products = session.scalar(select(func.count()).select_from(Product)) or 0
        existing_categories = session.scalar(select(func.count()).select_from(Category)) or 0
        if existing_products or existing_categories:
            raise RuntimeError(
                "E2E PostgreSQL database is not empty; refusing to mix synthetic data with existing records"
            )
        session.add_all([category, bottle, shirt, inactive])
        session.flush()
        session.add_all([
            ProductCategory(product_id=bottle.id, category_id=category.id),
            ProductCategory(product_id=shirt.id, category_id=category.id),
            ProductCategory(product_id=inactive.id, category_id=category.id),
            ProductImage(product_id=bottle.id, url="/images/homolog-bottle.png", alt_text="Homolog Bottle", position=0, is_primary=True),
        ])
        bottle_variant = ProductVariant(
            product_id=bottle.id, sku="HOMOLOG-BOTTLE-V1", name="Padrão",
            price=Decimal("89.90"), promotional_price=Decimal("0.00"),
            image_url="/images/homolog-bottle.png", position=0, is_active=True,
        )
        shirt_variant = ProductVariant(
            product_id=shirt.id, sku="HOMOLOG-SHIRT-V1", name="Padrão",
            price=Decimal("129.90"), promotional_price=Decimal("99.90"),
            position=0, is_active=True,
        )
        session.add_all([bottle_variant, shirt_variant])
        session.flush()
        session.add_all([
            Inventory(variant_id=bottle_variant.id, quantity_available=5, quantity_reserved=0),
            Inventory(variant_id=shirt_variant.id, quantity_available=0, quantity_reserved=0),
        ])
        session.commit()

    print(json.dumps({
        "category": category.slug,
        "active": [bottle.slug, shirt.slug],
        "inactive": inactive.slug,
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"catalog E2E seed failed: {exc}", file=sys.stderr)
        raise
