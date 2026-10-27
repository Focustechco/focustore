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


def test_list_products_empty(client):
    response = client.get("/products")

    assert response.status_code == 200
    assert response.json() == []


def test_list_products(client):
    category_response = client.post(
        "/categories",
        json={"name": "Periféricos", "slug": "perifericos"},
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]

    for name in ["Mouse", "Teclado"]:
        response = client.post(
            "/products",
            json={
                "name": name,
                "price": "99.90",
                "stock": 5,
                "category_id": category_id,
            },
        )
        assert response.status_code == 201

    response = client.get("/products")

    assert response.status_code == 200
    assert len(response.json()) == 2

    names = [product["name"] for product in response.json()]
    assert names == ["Mouse", "Teclado"]


def test_list_products_pagination(client):
    category_response = client.post(
        "/categories",
        json={"name": "Informática", "slug": "informatica"},
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]

    for name in ["Produto A", "Produto B", "Produto C"]:
        response = client.post(
            "/products",
            json={
                "name": name,
                "price": "50.00",
                "stock": 2,
                "category_id": category_id,
            },
        )
        assert response.status_code == 201

    response = client.get("/products?skip=1&limit=1")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Produto B"


def test_get_product_success(client):
    category_response = client.post(
        "/categories",
        json={"name": "Acessórios", "slug": "acessorios"},
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]

    created = client.post(
        "/products",
        json={
            "name": "Webcam",
            "price": "149.90",
            "stock": 8,
            "category_id": category_id,
        },
    )
    assert created.status_code == 201
    product_id = created.json()["id"]

    response = client.get(f"/products/{product_id}")

    assert response.status_code == 200
    assert response.json()["id"] == product_id
    assert response.json()["name"] == "Webcam"


def test_get_product_not_found(client):
    response = client.get("/products/99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Produto não encontrado."


def test_list_products_invalid_pagination(client):
    response = client.get("/products?skip=-1&limit=0")

    assert response.status_code == 422
