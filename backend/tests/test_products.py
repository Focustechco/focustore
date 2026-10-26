import pytest


def test_create_product_success(client):
    category = client.post(
        "/categories", json={"name": "Eletrônicos", "slug": "eletronicos"}
    )
    assert category.status_code == 201
    category_id = category.json()["id"]
    response = client.post(
        "/products",
        json={
            "name": "Teclado mecânico",
            "price": "199.90",
            "stock": 10,
            "category_id": category_id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data["id"], int)
    assert data["name"] == "Teclado mecânico"
    assert data["price"] == "199.90"
    assert data["stock"] == 10
    assert data["category_id"] == category_id


def test_create_product_category_not_found(client):
    response = client.post(
        "/products",
        json={
            "name": "Mouse",
            "price": "89.90",
            "stock": 5,
            "category_id": 99999,
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Categoria não encontrada."


@pytest.mark.parametrize("price", ["0", "-10.00"])
def test_create_product_invalid_price(client, price):
    response = client.post(
        "/products",
        json={"name": "Monitor", "price": price, "stock": 3, "category_id": 1},
    )
    assert response.status_code == 422


def test_create_product_negative_stock(client):
    response = client.post(
        "/products",
        json={
            "name": "Monitor",
            "price": "899.90",
            "stock": -1,
            "category_id": 1,
        },
    )
    assert response.status_code == 422
