import pytest


@pytest.fixture
def version_id(client, forecaster_headers) -> int:
    response = client.post("/api/versions", json={"comment": "for review"}, headers=forecaster_headers)
    return response.json()["id"]


def test_comments_start_empty(client, brand_lead_headers, version_id):
    response = client.get(f"/api/versions/{version_id}/comments", headers=brand_lead_headers)

    assert response.status_code == 200
    assert response.json() == []


def test_add_and_list_comments_in_order(
    client, brand_lead_headers, forecaster_headers, brand_lead_id, forecaster_id, version_id
):
    first = client.post(
        f"/api/versions/{version_id}/comments",
        json={"content": "  Uptake in 2028 looks aggressive.  "},
        headers=brand_lead_headers,
    )
    second = client.post(
        f"/api/versions/{version_id}/comments",
        json={"content": "Agreed, will revisit in Downside."},
        headers=forecaster_headers,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["content"] == "Uptake in 2028 looks aggressive."
    assert first.json()["user_id"] == brand_lead_id
    assert first.json()["version_id"] == version_id

    comments = client.get(f"/api/versions/{version_id}/comments", headers=brand_lead_headers).json()
    assert [(c["user_id"], c["content"]) for c in comments] == [
        (brand_lead_id, "Uptake in 2028 looks aggressive."),
        (forecaster_id, "Agreed, will revisit in Downside."),
    ]


def test_comments_include_author_email_and_role(client, brand_lead_headers, brand_lead_id, version_id):
    client.post(f"/api/versions/{version_id}/comments", json={"content": "Looks reasonable"}, headers=brand_lead_headers)

    comment = client.get(f"/api/versions/{version_id}/comments", headers=brand_lead_headers).json()[0]

    assert comment["author"] == {"id": brand_lead_id, "email": "brandlead@example.com", "role": "BRAND_LEAD"}
    assert "password_hash" not in str(comment)


def test_comments_belong_to_one_version(client, forecaster_headers, brand_lead_headers, version_id):
    other_version = client.post("/api/versions", headers=forecaster_headers).json()["id"]
    client.post(f"/api/versions/{version_id}/comments", json={"content": "On v1"}, headers=brand_lead_headers)

    response = client.get(f"/api/versions/{other_version}/comments", headers=brand_lead_headers)

    assert response.json() == []


@pytest.mark.parametrize("body", [{}, {"content": ""}, {"content": "   "}, {"content": "x" * 5001}])
def test_invalid_comment_is_422(client, brand_lead_headers, version_id, body):
    response = client.post(f"/api/versions/{version_id}/comments", json=body, headers=brand_lead_headers)

    assert response.status_code == 422


def test_comments_on_unknown_version_are_404(client, brand_lead_headers):
    assert client.get("/api/versions/999999/comments", headers=brand_lead_headers).status_code == 404
    response = client.post(
        "/api/versions/999999/comments", json={"content": "hello"}, headers=brand_lead_headers
    )
    assert response.status_code == 404
