def test_create_category_success(client):
    response = client.post(
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


def test_create_category_duplicate_slug(client):
    category = {
        "name": "Eletrônicos",
        "slug": "eletronicos",
    }

    first_response = client.post("/categories", json=category)

    assert first_response.status_code == 201

    second_response = client.post("/categories", json=category)

    assert second_response.status_code == 409
    assert second_response.json()["detail"] == (
        "Já existe uma categoria com esse slug."
    )


def test_create_category_invalid_data(client):
    response = client.post(
        "/categories",
        json={
            "name": "",
            "slug": "",
        },
    )

    assert response.status_code == 422