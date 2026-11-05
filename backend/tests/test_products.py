import pytest

from app.services.management import product_slug


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Teclado mecânico", "teclado-mecanico"),
        ("Legacy Product 12", "legacy-product-12-item"),
        ("!!!", "produto"),
    ],
)
def test_product_slug_is_stable_and_reserves_legacy_fallback(name, expected):
    assert product_slug(name) == expected


def test_create_product_success(admin_client):
    category = admin_client.post(
        "/categories", json={"name": "Eletrônicos", "slug": "eletronicos"}
    )
    assert category.status_code == 201
    category_id = category.json()["id"]
    response = admin_client.post(
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


def test_create_product_category_not_found(admin_client):
    response = admin_client.post(
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
def test_create_product_invalid_price(admin_client, price):
    response = admin_client.post(
        "/products",
        json={"name": "Monitor", "price": price, "stock": 3, "category_id": 1},
    )
    assert response.status_code == 422


def test_create_product_negative_stock(admin_client):
    response = admin_client.post(
        "/products",
        json={
            "name": "Monitor",
            "price": "899.90",
            "stock": -1,
            "category_id": 1,
        },
    )
    assert response.status_code == 422


def test_list_products_empty(admin_client):
    response = admin_client.get("/products")

    assert response.status_code == 200
    assert response.json() == []


def test_list_products(admin_client):
    category_response = admin_client.post(
        "/categories",
        json={"name": "Periféricos", "slug": "perifericos"},
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]

    for name in ["Mouse", "Teclado"]:
        response = admin_client.post(
            "/products",
            json={
                "name": name,
                "price": "99.90",
                "stock": 5,
                "category_id": category_id,
            },
        )
        assert response.status_code == 201

    response = admin_client.get("/products")

    assert response.status_code == 200
    assert len(response.json()) == 2

    names = [product["name"] for product in response.json()]
    assert names == ["Mouse", "Teclado"]


def test_list_products_pagination(admin_client):
    category_response = admin_client.post(
        "/categories",
        json={"name": "Informática", "slug": "informatica"},
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]

    for name in ["Produto A", "Produto B", "Produto C"]:
        response = admin_client.post(
            "/products",
            json={
                "name": name,
                "price": "50.00",
                "stock": 2,
                "category_id": category_id,
            },
        )
        assert response.status_code == 201

    response = admin_client.get("/products?skip=1&limit=1")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Produto B"


def test_get_product_success(admin_client):
    category_response = admin_client.post(
        "/categories",
        json={"name": "Acessórios", "slug": "acessorios"},
    )
    assert category_response.status_code == 201
    category_id = category_response.json()["id"]

    created = admin_client.post(
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

    response = admin_client.get(f"/products/{product_id}")

    assert response.status_code == 200
    assert response.json()["id"] == product_id
    assert response.json()["name"] == "Webcam"


def test_get_product_not_found(admin_client):
    response = admin_client.get("/products/99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Produto não encontrado."


def test_list_products_invalid_pagination(admin_client):
    response = admin_client.get("/products?skip=-1&limit=0")

    assert response.status_code == 422


def test_stock_adjustment_is_atomic_and_persists(admin_client):
    category = admin_client.post(
        "/categories", json={"name": "Estoque", "slug": "estoque"}
    )
    product = admin_client.post(
        "/products",
        json={"name": "Item em estoque", "price": "10.00", "stock": 2,
              "category_id": category.json()["id"]},
    )
    product_id = product.json()["id"]

    response = admin_client.post(
        f"/products/{product_id}/stock-adjustments", json={"delta": 3}
    )
    assert response.status_code == 200
    assert response.json()["stock"] == 5


def test_stock_adjustment_rejects_negative_result_without_mutating(admin_client):
    category = admin_client.post(
        "/categories", json={"name": "Limite", "slug": "limite"}
    )
    product = admin_client.post(
        "/products",
        json={"name": "Estoque limitado", "price": "10.00", "stock": 1,
              "category_id": category.json()["id"]},
    )
    product_id = product.json()["id"]

    response = admin_client.post(
        f"/products/{product_id}/stock-adjustments", json={"delta": -2}
    )
    assert response.status_code == 409
    assert admin_client.get(f"/products/{product_id}").json()["stock"] == 1


def test_stock_adjustment_requires_administrator(client):
    response = client.post(
        "/products/1/stock-adjustments", json={"delta": 1}
    )
    assert response.status_code == 401
