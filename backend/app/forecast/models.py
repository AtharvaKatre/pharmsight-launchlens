"""Typed input and output models for the forecast engine.

Percentages are expressed on a 0-100 scale (e.g. 60 means 60%).
All numeric values are Decimal so no precision is lost during calculation;
rounding is left to the presentation layer.
"""

from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

FORECAST_START_YEAR = 2027
FORECAST_END_YEAR = 2036
FORECAST_YEARS: tuple[int, ...] = tuple(range(FORECAST_START_YEAR, FORECAST_END_YEAR + 1))

Percentage = Annotated[Decimal, Field(ge=0, le=100)]
NonNegative = Annotated[Decimal, Field(ge=0)]


class YearInput(BaseModel):
    """All assumptions for a single forecast year. Every value is independently editable."""

    model_config = ConfigDict(extra="forbid")

    year: int
    prevalent_patients: NonNegative
    diagnosed_pct: Percentage
    drug_treated_pct: Percentage
    eligible_pct: Percentage
    peak_brand_share_pct: Percentage
    uptake_pct: Percentage
    compliance_pct: Percentage
    annual_price: NonNegative
    gross_to_net_pct: Percentage


class ForecastInput(BaseModel):
    """A complete set of annual assumptions covering every forecast year exactly once."""

    model_config = ConfigDict(extra="forbid")

    years: list[YearInput]

    @model_validator(mode="after")
    def _check_forecast_years(self) -> "ForecastInput":
        provided = [y.year for y in self.years]
        expected = set(FORECAST_YEARS)

        missing = sorted(expected - set(provided))
        unexpected = sorted(set(provided) - expected)
        duplicates = sorted({y for y in provided if provided.count(y) > 1})

        errors = []
        if missing:
            errors.append(f"missing forecast years: {missing}")
        if unexpected:
            errors.append(
                f"years outside forecast period {FORECAST_START_YEAR}-{FORECAST_END_YEAR}: {unexpected}"
            )
        if duplicates:
            errors.append(f"duplicate forecast years: {duplicates}")
        if errors:
            raise ValueError("; ".join(errors))

        self.years = sorted(self.years, key=lambda y: y.year)
        return self


class YearResult(BaseModel):
    """Patient funnel and revenue for a single year (unrounded)."""

    year: int
    prevalent_patients: Decimal
    diagnosed_patients: Decimal
    drug_treated_patients: Decimal
    eligible_patients: Decimal
    peak_brand_patients: Decimal
    patients_on_drug: Decimal
    compliant_patients: Decimal
    gross_revenue: Decimal
    net_revenue: Decimal


class ForecastResult(BaseModel):
    years: list[YearResult]
