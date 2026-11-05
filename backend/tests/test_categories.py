import pytest


def test_create_category_success(admin_client):
    response = admin_client.post(
        "/categories",
        json={
            "name": "Eletrônicos",
            "slug": "eletronicos",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert isinstance(data["id"], int)
    assert data["name"] == "Eletrônicos"
    assert data["slug"] == "eletronicos"


def test_create_category_duplicate_slug(admin_client):
    category = {
        "name": "Eletrônicos",
        "slug": "eletronicos",
    }

    first_response = admin_client.post("/categories", json=category)

    assert first_response.status_code == 201

    second_response = admin_client.post("/categories", json=category)

    assert second_response.status_code == 409
    assert second_response.json()["detail"] == (
        "Já existe uma categoria com esse slug."
    )


def test_create_category_invalid_data(admin_client):
    response = admin_client.post(
        "/categories",
        json={
            "name": "",
            "slug": "",
        },
    )

    assert response.status_code == 422


def test_delete_category_linked_through_product_categories_is_rejected():
    from decimal import Decimal

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.db.base import Base
    from app.models import Category, Product
    from app.services.management import DomainError, delete_resource

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            primary = Category(name="Primária", slug="primaria")
            secondary = Category(name="Secundária", slug="secundaria")
            product = Product(
                name="Produto categorizado",
                price=Decimal("10.00"),
                stock=1,
                category=primary,
                slug="produto-categorizado",
            )
            product.categories.append(secondary)
            db.add(product)
            db.commit()

            with pytest.raises(DomainError, match="Categoria possui produtos vinculados"):
                delete_resource(db, Category, secondary.id)
    finally:
        engine.dispose()
