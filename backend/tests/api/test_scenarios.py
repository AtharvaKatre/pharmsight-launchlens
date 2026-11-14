from decimal import Decimal

import pytest

from app.forecast import YearInput, YearResult, calculate_forecast, generate_base_assumptions
from tests.api.conftest import base_years_payload, scenario_payload


def scenario_ids_by_name(client, headers) -> dict[str, int]:
    return {s["name"]: s["id"] for s in client.get("/api/scenarios", headers=headers).json()}


def years_of(client, headers, scenario_id) -> list[YearInput]:
    response = client.get(f"/api/scenarios/{scenario_id}", headers=headers)
    assert response.status_code == 200
    return [YearInput.model_validate(y) for y in response.json()["years"]]


# --- Seeded scenarios ------------------------------------------------------


def test_seeded_scenarios_are_listed(client, forecaster_headers, forecaster_id):
    response = client.get("/api/scenarios", headers=forecaster_headers)

    assert response.status_code == 200
    scenarios = response.json()
    assert [s["name"] for s in scenarios] == ["Base", "Upside", "Downside"]
    assert all(s["created_by"] == forecaster_id for s in scenarios)
    assert all("years" not in s for s in scenarios)


def test_seeded_scenarios_all_use_base_assumptions(client, forecaster_headers):
    expected = generate_base_assumptions().years

    for scenario_id in scenario_ids_by_name(client, forecaster_headers).values():
        assert years_of(client, forecaster_headers, scenario_id) == expected


def test_decimal_precision_survives_database_round_trip(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]

    years = years_of(client, forecaster_headers, base_id)

    assert years[-1].year == 2036
    assert years[-1].prevalent_patients == Decimal("2000000") * Decimal("1.01") ** 9


def test_get_unknown_scenario_is_404(client, forecaster_headers):
    response = client.get("/api/scenarios/999999", headers=forecaster_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Scenario 999999 not found"


# --- Create ----------------------------------------------------------------


def test_create_scenario_with_explicit_years(client, forecaster_headers, forecaster_id):
    payload = scenario_payload("High price", "Price sensitivity", annual_price="12000")

    response = client.post("/api/scenarios", json=payload, headers=forecaster_headers)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "High price"
    assert body["description"] == "Price sensitivity"
    assert body["created_by"] == forecaster_id
    assert len(body["years"]) == 10
    assert all(Decimal(y["annual_price"]) == 12000 for y in body["years"])
    assert years_of(client, forecaster_headers, body["id"])[0].annual_price == 12000


def test_create_scenario_without_years_starts_from_base(client, forecaster_headers):
    response = client.post("/api/scenarios", json={"name": "Blank"}, headers=forecaster_headers)

    assert response.status_code == 201
    assert years_of(client, forecaster_headers, response.json()["id"]) == generate_base_assumptions().years


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(lambda p: p["years"].pop(4), id="missing-year"),
        pytest.param(lambda p: p["years"].append(dict(p["years"][0])), id="duplicate-year"),
        pytest.param(lambda p: p["years"][0].update(year=2040), id="year-out-of-range"),
        pytest.param(lambda p: p["years"][0].update(uptake_pct="100.5"), id="percentage-over-100"),
        pytest.param(lambda p: p["years"][0].update(compliance_pct="-1"), id="negative-percentage"),
        pytest.param(lambda p: p["years"][0].update(annual_price="-1"), id="negative-price"),
        pytest.param(lambda p: p["years"][0].update(prevalent_patients="-5"), id="negative-population"),
        pytest.param(lambda p: p["years"][0].pop("diagnosed_pct"), id="missing-field"),
        pytest.param(lambda p: p.update(name="   "), id="blank-name"),
        pytest.param(lambda p: p.update(name="x" * 201), id="name-too-long"),
        pytest.param(lambda p: p.update(unexpected="field"), id="unknown-field"),
    ],
)
def test_create_scenario_with_invalid_data_is_422(client, forecaster_headers, mutate):
    payload = scenario_payload()
    mutate(payload)

    response = client.post("/api/scenarios", json=payload, headers=forecaster_headers)

    assert response.status_code == 422
    assert len(client.get("/api/scenarios", headers=forecaster_headers).json()) == 3


# --- Update ----------------------------------------------------------------


def test_update_replaces_name_description_and_inputs(client, forecaster_headers):
    ids = scenario_ids_by_name(client, forecaster_headers)
    before = client.get(f"/api/scenarios/{ids['Upside']}", headers=forecaster_headers).json()
    payload = scenario_payload("Upside v2", "Faster uptake", uptake_pct="100")

    response = client.put(f"/api/scenarios/{ids['Upside']}", json=payload, headers=forecaster_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Upside v2"
    assert body["description"] == "Faster uptake"
    assert body["updated_at"] > before["updated_at"]
    assert body["created_at"] == before["created_at"]
    assert all(y.uptake_pct == 100 for y in years_of(client, forecaster_headers, ids["Upside"]))


def test_update_single_year_value_only_changes_that_year(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]
    payload = scenario_payload("Base")
    payload["years"][3]["prevalent_patients"] = "2500000"  # 2030 only

    client.put(f"/api/scenarios/{base_id}", json=payload, headers=forecaster_headers)

    years = {y.year: y for y in years_of(client, forecaster_headers, base_id)}
    expected = {y.year: y for y in generate_base_assumptions().years}
    assert years[2030].prevalent_patients == 2500000
    assert years[2031].prevalent_patients == expected[2031].prevalent_patients
    assert years[2029].prevalent_patients == expected[2029].prevalent_patients


def test_editing_one_scenario_never_affects_another(client, forecaster_headers):
    ids = scenario_ids_by_name(client, forecaster_headers)

    response = client.put(
        f"/api/scenarios/{ids['Downside']}",
        json=scenario_payload("Downside", peak_brand_share_pct="10", annual_price="8000"),
        headers=forecaster_headers,
    )

    assert response.status_code == 200
    base = generate_base_assumptions().years
    assert years_of(client, forecaster_headers, ids["Base"]) == base
    assert years_of(client, forecaster_headers, ids["Upside"]) == base
    assert all(y.peak_brand_share_pct == 10 for y in years_of(client, forecaster_headers, ids["Downside"]))


def test_invalid_update_is_422_and_leaves_scenario_unchanged(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]
    payload = scenario_payload("Renamed", eligible_pct="150")

    response = client.put(f"/api/scenarios/{base_id}", json=payload, headers=forecaster_headers)

    assert response.status_code == 422
    detail = client.get(f"/api/scenarios/{base_id}", headers=forecaster_headers).json()
    assert detail["name"] == "Base"
    assert years_of(client, forecaster_headers, base_id) == generate_base_assumptions().years


def test_update_with_missing_year_is_422(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]
    payload = scenario_payload("Base")
    payload["years"] = payload["years"][:9]

    response = client.put(f"/api/scenarios/{base_id}", json=payload, headers=forecaster_headers)

    assert response.status_code == 422
    assert "missing forecast years: [2036]" in response.text


def test_update_requires_all_fields(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]

    response = client.put(f"/api/scenarios/{base_id}", json={"name": "Base"}, headers=forecaster_headers)

    assert response.status_code == 422


def test_update_unknown_scenario_is_404(client, forecaster_headers):
    response = client.put("/api/scenarios/999999", json=scenario_payload(), headers=forecaster_headers)

    assert response.status_code == 404


# --- Delete ----------------------------------------------------------------


def test_delete_scenario(client, forecaster_headers):
    ids = scenario_ids_by_name(client, forecaster_headers)

    response = client.delete(f"/api/scenarios/{ids['Upside']}", headers=forecaster_headers)

    assert response.status_code == 204
    assert client.get(f"/api/scenarios/{ids['Upside']}", headers=forecaster_headers).status_code == 404
    assert list(scenario_ids_by_name(client, forecaster_headers)) == ["Base", "Downside"]
    assert years_of(client, forecaster_headers, ids["Base"]) == generate_base_assumptions().years


def test_delete_unknown_scenario_is_404(client, forecaster_headers):
    assert client.delete("/api/scenarios/999999", headers=forecaster_headers).status_code == 404


# --- Clone -----------------------------------------------------------------


def test_clone_copies_inputs_into_new_scenario(client, forecaster_headers):
    ids = scenario_ids_by_name(client, forecaster_headers)
    client.put(
        f"/api/scenarios/{ids['Upside']}",
        json=scenario_payload("Upside", "Optimistic", compliance_pct="90"),
        headers=forecaster_headers,
    )

    response = client.post(f"/api/scenarios/{ids['Upside']}/clone", headers=forecaster_headers)

    assert response.status_code == 201
    clone = response.json()
    assert clone["id"] not in ids.values()
    assert clone["name"] == "Upside (copy)"
    assert clone["description"] == "Optimistic"
    assert years_of(client, forecaster_headers, clone["id"]) == years_of(
        client, forecaster_headers, ids["Upside"]
    )


def test_clone_with_custom_name(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]

    response = client.post(
        f"/api/scenarios/{base_id}/clone", json={"name": "Base - payer pushback"}, headers=forecaster_headers
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Base - payer pushback"


def test_clone_is_independent_of_its_source(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]
    clone_id = client.post(f"/api/scenarios/{base_id}/clone", headers=forecaster_headers).json()["id"]

    client.put(f"/api/scenarios/{clone_id}", json=scenario_payload("Clone", uptake_pct="50"), headers=forecaster_headers)
    assert years_of(client, forecaster_headers, base_id) == generate_base_assumptions().years

    client.put(f"/api/scenarios/{base_id}", json=scenario_payload("Base", diagnosed_pct="70"), headers=forecaster_headers)
    assert all(y.diagnosed_pct == 60 for y in years_of(client, forecaster_headers, clone_id))
    assert all(y.uptake_pct == 50 for y in years_of(client, forecaster_headers, clone_id))


def test_clone_unknown_scenario_is_404(client, forecaster_headers):
    assert client.post("/api/scenarios/999999/clone", headers=forecaster_headers).status_code == 404


# --- Forecast --------------------------------------------------------------


def test_forecast_matches_engine_for_base_scenario(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]

    response = client.get(f"/api/scenarios/{base_id}/forecast", headers=forecaster_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["scenario_id"] == base_id
    results = [YearResult.model_validate(y) for y in body["years"]]
    assert results == calculate_forecast(generate_base_assumptions()).years
    assert results[0].year == 2027
    assert results[0].patients_on_drug == 4800
    assert results[0].net_revenue == 28_800_000


def test_forecast_reflects_worked_example_after_edit(client, forecaster_headers):
    base_id = scenario_ids_by_name(client, forecaster_headers)["Base"]
    payload = {
        "name": "Worked example",
        "years": [{**y, "prevalent_patients": "2000000", "uptake_pct": "100"} for y in base_years_payload()],
    }
    client.put(f"/api/scenarios/{base_id}", json=payload, headers=forecaster_headers)

    body = client.get(f"/api/scenarios/{base_id}/forecast", headers=forecaster_headers).json()

    for year in body["years"]:
        assert Decimal(year["patients_on_drug"]) == 48_000
        assert Decimal(year["gross_revenue"]) == 384_000_000
        assert Decimal(year["net_revenue"]) == 288_000_000


def test_forecast_for_unknown_scenario_is_404(client, forecaster_headers):
    assert client.get("/api/scenarios/999999/forecast", headers=forecaster_headers).status_code == 404
