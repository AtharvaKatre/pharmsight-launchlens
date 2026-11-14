from decimal import Decimal

import pytest

from app.forecast.models import FORECAST_YEARS, ForecastInput, YearInput

# Worked example from the requirements (population growth disabled, uptake 100%).
WORKED_EXAMPLE = {
    "prevalent_patients": Decimal("2000000"),
    "diagnosed_pct": Decimal("60"),
    "drug_treated_pct": Decimal("50"),
    "eligible_pct": Decimal("40"),
    "peak_brand_share_pct": Decimal("20"),
    "uptake_pct": Decimal("100"),
    "compliance_pct": Decimal("80"),
    "annual_price": Decimal("10000"),
    "gross_to_net_pct": Decimal("25"),
}

PERCENTAGE_FIELDS = [
    "diagnosed_pct",
    "drug_treated_pct",
    "eligible_pct",
    "peak_brand_share_pct",
    "uptake_pct",
    "compliance_pct",
    "gross_to_net_pct",
]


@pytest.fixture
def make_year():
    """Build a YearInput from the worked example, with optional overrides."""

    def _make(year: int = FORECAST_YEARS[0], **overrides) -> YearInput:
        return YearInput(**{**WORKED_EXAMPLE, "year": year, **overrides})

    return _make


@pytest.fixture
def make_forecast_input(make_year):
    """Build a full ten-year ForecastInput using the same values for every year."""

    def _make(**overrides) -> ForecastInput:
        return ForecastInput(years=[make_year(year, **overrides) for year in FORECAST_YEARS])

    return _make
