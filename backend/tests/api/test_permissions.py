"""Role enforcement happens in backend dependencies, independent of any frontend."""

import pytest

from app.forecast import generate_base_assumptions
from tests.api.conftest import scenario_payload

# Scenario 1 is the seeded Base scenario (identities are reset before each test).
FORECASTER_ONLY = [
    ("POST", "/api/scenarios", scenario_payload("Brand lead scenario")),
    ("PUT", "/api/scenarios/1", scenario_payload("Hijacked", uptake_pct="1")),
    ("DELETE", "/api/scenarios/1", None),
    ("POST", "/api/scenarios/1/clone", None),
    ("POST", "/api/versions", {"comment": "brand lead save"}),
]

ALL_ENDPOINTS = [
    ("GET", "/api/auth/me", None),
    ("GET", "/api/scenarios", None),
    ("GET", "/api/scenarios/1", None),
    ("GET", "/api/scenarios/1/forecast", None),
    ("GET", "/api/versions", None),
    ("GET", "/api/versions/1", None),
    ("GET", "/api/versions/1/comments", None),
    ("POST", "/api/versions/1/comments", {"content": "hi"}),
    *FORECASTER_ONLY,
]


def _ids(endpoints):
    return [f"{method} {url}" for method, url, _ in endpoints]


@pytest.mark.parametrize("method, url, body", FORECASTER_ONLY, ids=_ids(FORECASTER_ONLY))
def test_brand_lead_cannot_modify_scenarios_or_save_versions(
    client, brand_lead_headers, forecaster_headers, method, url, body
):
    response = client.request(method, url, json=body, headers=brand_lead_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Only Forecasters can perform this action"

    # Nothing changed.
    scenarios = client.get("/api/scenarios", headers=forecaster_headers).json()
    assert [s["name"] for s in scenarios] == ["Base", "Upside", "Downside"]
    base = client.get("/api/scenarios/1", headers=forecaster_headers).json()
    assert [y["uptake_pct"] for y in base["years"]] == [
        str(y.uptake_pct) for y in generate_base_assumptions().years
    ]
    assert client.get("/api/versions", headers=forecaster_headers).json() == []


@pytest.mark.parametrize("method, url, body", ALL_ENDPOINTS, ids=_ids(ALL_ENDPOINTS))
def test_unauthenticated_requests_are_401(client, method, url, body):
    response = client.request(method, url, json=body)

    assert response.status_code == 401


def test_brand_lead_can_view_scenarios_forecasts_and_versions(
    client, forecaster_headers, brand_lead_headers
):
    version_id = client.post("/api/versions", headers=forecaster_headers).json()["id"]

    for url in [
        "/api/scenarios",
        "/api/scenarios/1",
        "/api/scenarios/1/forecast",
        "/api/versions",
        f"/api/versions/{version_id}",
        f"/api/versions/{version_id}/comments",
    ]:
        assert client.get(url, headers=brand_lead_headers).status_code == 200, url


@pytest.mark.parametrize("headers_fixture", ["brand_lead_headers", "forecaster_headers"])
def test_both_roles_can_comment_on_versions(client, forecaster_headers, request, headers_fixture):
    version_id = client.post("/api/versions", headers=forecaster_headers).json()["id"]
    headers = request.getfixturevalue(headers_fixture)

    response = client.post(
        f"/api/versions/{version_id}/comments", json={"content": "Looks good"}, headers=headers
    )

    assert response.status_code == 201


def test_forecaster_can_perform_all_scenario_actions(client, forecaster_headers):
    created = client.post("/api/scenarios", json=scenario_payload("Mine"), headers=forecaster_headers)
    assert created.status_code == 201
    scenario_id = created.json()["id"]

    assert client.put(
        f"/api/scenarios/{scenario_id}", json=scenario_payload("Mine v2"), headers=forecaster_headers
    ).status_code == 200
    assert client.post(f"/api/scenarios/{scenario_id}/clone", headers=forecaster_headers).status_code == 201
    assert client.delete(f"/api/scenarios/{scenario_id}", headers=forecaster_headers).status_code == 204
    assert client.post("/api/versions", headers=forecaster_headers).status_code == 201
