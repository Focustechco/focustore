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