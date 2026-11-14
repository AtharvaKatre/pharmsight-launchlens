import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.forecast import YearInput, YearResult, calculate_forecast, generate_base_assumptions
from tests.api.conftest import scenario_payload


def save_version(client, headers, comment=None):
    body = {"comment": comment} if comment is not None else None
    response = client.post("/api/versions", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def scenario_id(client, headers, name) -> int:
    return next(s["id"] for s in client.get("/api/scenarios", headers=headers).json() if s["name"] == name)


def test_save_version_snapshots_entire_workspace(client, forecaster_headers, forecaster_id):
    version = save_version(client, forecaster_headers, "Initial baseline")

    assert version["comment"] == "Initial baseline"
    assert version["created_by"] == forecaster_id
    scenarios = version["snapshot"]["scenarios"]
    assert [s["name"] for s in scenarios] == ["Base", "Upside", "Downside"]
    assert scenarios[0]["description"] == "Base case assumptions"

    expected_inputs = generate_base_assumptions()
    expected_results = calculate_forecast(expected_inputs).years
    for scenario in scenarios:
        assert [YearInput.model_validate(y) for y in scenario["years"]] == expected_inputs.years
        assert [YearResult.model_validate(y) for y in scenario["forecast"]] == expected_results


def test_snapshot_reflects_current_edits_and_new_scenarios(client, forecaster_headers):
    client.put(
        f"/api/scenarios/{scenario_id(client, forecaster_headers, 'Downside')}",
        json=scenario_payload("Downside", "Lower share", peak_brand_share_pct="15"),
        headers=forecaster_headers,
    )
    client.post("/api/scenarios", json={"name": "Extra"}, headers=forecaster_headers)

    scenarios = save_version(client, forecaster_headers)["snapshot"]["scenarios"]

    assert [s["name"] for s in scenarios] == ["Base", "Upside", "Downside", "Extra"]
    downside = scenarios[2]
    assert downside["description"] == "Lower share"
    assert all(YearInput.model_validate(y).peak_brand_share_pct == 15 for y in downside["years"])
    assert YearResult.model_validate(downside["forecast"][0]).peak_brand_patients == 36_000


def test_version_comment_is_optional(client, forecaster_headers):
    assert save_version(client, forecaster_headers)["comment"] is None


def test_version_comment_too_long_is_422(client, forecaster_headers):
    response = client.post("/api/versions", json={"comment": "x" * 2001}, headers=forecaster_headers)

    assert response.status_code == 422


def test_list_versions_newest_first_without_snapshot(client, forecaster_headers):
    first = save_version(client, forecaster_headers, "first")
    second = save_version(client, forecaster_headers, "second")

    response = client.get("/api/versions", headers=forecaster_headers)

    assert response.status_code == 200
    versions = response.json()
    assert [v["id"] for v in versions] == [second["id"], first["id"]]
    assert all("snapshot" not in v for v in versions)


def test_get_version_returns_full_snapshot(client, forecaster_headers):
    saved = save_version(client, forecaster_headers, "baseline")

    response = client.get(f"/api/versions/{saved['id']}", headers=forecaster_headers)

    assert response.status_code == 200
    assert response.json() == saved


def test_get_unknown_version_is_404(client, forecaster_headers):
    response = client.get("/api/versions/999999", headers=forecaster_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Version 999999 not found"


def test_snapshot_is_unchanged_after_scenarios_are_edited_or_deleted(client, forecaster_headers):
    saved = save_version(client, forecaster_headers, "before changes")
    base_id = scenario_id(client, forecaster_headers, "Base")
    upside_id = scenario_id(client, forecaster_headers, "Upside")

    client.put(f"/api/scenarios/{base_id}", json=scenario_payload("Base edited", uptake_pct="5"), headers=forecaster_headers)
    client.delete(f"/api/scenarios/{upside_id}", headers=forecaster_headers)

    assert client.get(f"/api/versions/{saved['id']}", headers=forecaster_headers).json() == saved


def test_historical_versions_are_independently_viewable(client, forecaster_headers):
    v1 = save_version(client, forecaster_headers, "v1")
    base_id = scenario_id(client, forecaster_headers, "Base")
    client.put(f"/api/scenarios/{base_id}", json=scenario_payload("Base", annual_price="12000"), headers=forecaster_headers)
    v2 = save_version(client, forecaster_headers, "v2")

    v1_base = client.get(f"/api/versions/{v1['id']}", headers=forecaster_headers).json()["snapshot"]["scenarios"][0]
    v2_base = client.get(f"/api/versions/{v2['id']}", headers=forecaster_headers).json()["snapshot"]["scenarios"][0]

    assert YearInput.model_validate(v1_base["years"][0]).annual_price == 10000
    assert YearInput.model_validate(v2_base["years"][0]).annual_price == 12000
    assert YearResult.model_validate(v1_base["forecast"][0]).gross_revenue == 38_400_000
    assert YearResult.model_validate(v2_base["forecast"][0]).gross_revenue == 46_080_000


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE forecast_versions SET comment = 'tampered'",
        "UPDATE forecast_versions SET snapshot = '{}'::jsonb",
        "DELETE FROM forecast_versions",
    ],
)
def test_database_refuses_to_modify_saved_versions(client, forecaster_headers, session_factory, statement):
    saved = save_version(client, forecaster_headers, "locked")

    with session_factory() as db, pytest.raises(DBAPIError, match="immutable"):
        db.execute(text(statement))
        db.commit()

    assert client.get(f"/api/versions/{saved['id']}", headers=forecaster_headers).json() == saved
