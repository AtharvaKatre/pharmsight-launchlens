from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.forecast.models import FORECAST_YEARS, ForecastInput, YearInput
from tests.conftest import PERCENTAGE_FIELDS, WORKED_EXAMPLE


# --- Percentage boundaries -------------------------------------------------


@pytest.mark.parametrize("field", PERCENTAGE_FIELDS)
@pytest.mark.parametrize("value", [0, 100, Decimal("0.0001"), Decimal("99.9999")])
def test_percentage_boundaries_are_accepted(make_year, field, value):
    assert getattr(make_year(**{field: value}), field) == value


@pytest.mark.parametrize("field", PERCENTAGE_FIELDS)
@pytest.mark.parametrize("value", [-1, Decimal("-0.0001"), Decimal("100.0001"), 101])
def test_percentage_out_of_range_is_rejected(make_year, field, value):
    with pytest.raises(ValidationError) as exc:
        make_year(**{field: value})
    assert exc.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize("field", PERCENTAGE_FIELDS)
@pytest.mark.parametrize("value", ["abc", None, "NaN", float("inf")])
def test_percentage_non_numeric_is_rejected(make_year, field, value):
    with pytest.raises(ValidationError):
        make_year(**{field: value})


# --- Negative inputs -------------------------------------------------------


@pytest.mark.parametrize("field", ["prevalent_patients", "annual_price"])
def test_negative_values_are_rejected(make_year, field):
    with pytest.raises(ValidationError) as exc:
        make_year(**{field: -1})
    assert exc.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize("field", ["prevalent_patients", "annual_price"])
def test_zero_values_are_accepted(make_year, field):
    assert getattr(make_year(**{field: 0}), field) == 0


# --- Missing fields --------------------------------------------------------


@pytest.mark.parametrize("field", list(WORKED_EXAMPLE))
def test_missing_annual_input_is_rejected(field):
    values = {**WORKED_EXAMPLE, "year": 2027}
    del values[field]

    with pytest.raises(ValidationError) as exc:
        YearInput(**values)
    assert exc.value.errors()[0]["type"] == "missing"


# --- Forecast years --------------------------------------------------------


def test_complete_forecast_years_are_accepted(make_forecast_input):
    assert len(make_forecast_input().years) == 10


def test_missing_forecast_year_is_rejected(make_year):
    years = [make_year(year) for year in FORECAST_YEARS if year != 2031]

    with pytest.raises(ValidationError, match=r"missing forecast years: \[2031\]"):
        ForecastInput(years=years)


def test_multiple_missing_forecast_years_are_reported(make_year):
    years = [make_year(year) for year in FORECAST_YEARS[:7]]

    with pytest.raises(ValidationError, match=r"missing forecast years: \[2034, 2035, 2036\]"):
        ForecastInput(years=years)


def test_empty_forecast_is_rejected():
    with pytest.raises(ValidationError, match="missing forecast years"):
        ForecastInput(years=[])


def test_duplicate_forecast_year_is_rejected(make_year):
    years = [make_year(year) for year in FORECAST_YEARS] + [make_year(2030)]

    with pytest.raises(ValidationError, match=r"duplicate forecast years: \[2030\]"):
        ForecastInput(years=years)


def test_year_outside_forecast_period_is_rejected(make_year):
    years = [make_year(year) for year in FORECAST_YEARS] + [make_year(2037)]

    with pytest.raises(ValidationError, match=r"outside forecast period 2027-2036: \[2037\]"):
        ForecastInput(years=years)


def test_replacing_a_year_with_an_out_of_range_year_is_rejected(make_year):
    years = [make_year(year) for year in FORECAST_YEARS if year != 2027] + [make_year(2026)]

    with pytest.raises(ValidationError) as exc:
        ForecastInput(years=years)
    message = str(exc.value)
    assert "missing forecast years: [2027]" in message
    assert "[2026]" in message
