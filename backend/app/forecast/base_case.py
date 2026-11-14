"""Base scenario assumptions and the function that builds the initial ten-year inputs.

The population growth rate is only used to seed each year's population; once
generated, every year's population is an independent, editable value.
"""

from decimal import Decimal

from app.forecast.models import FORECAST_START_YEAR, FORECAST_YEARS, ForecastInput, YearInput

BASE_PREVALENT_PATIENTS = Decimal("2000000")  # in FORECAST_START_YEAR
BASE_POPULATION_GROWTH_PCT = Decimal("1")
BASE_DIAGNOSED_PCT = Decimal("60")
BASE_DRUG_TREATED_PCT = Decimal("50")
BASE_ELIGIBLE_PCT = Decimal("40")
BASE_PEAK_BRAND_SHARE_PCT = Decimal("20")
BASE_UPTAKE_PCT: dict[int, Decimal] = {
    2027: Decimal("10"),
    2028: Decimal("30"),
    2029: Decimal("55"),
    2030: Decimal("80"),
    2031: Decimal("100"),
    2032: Decimal("100"),
    2033: Decimal("100"),
    2034: Decimal("100"),
    2035: Decimal("100"),
    2036: Decimal("100"),
}
BASE_COMPLIANCE_PCT = Decimal("80")
BASE_ANNUAL_PRICE = Decimal("10000")
BASE_GROSS_TO_NET_PCT = Decimal("25")


def project_population(start_population: Decimal, annual_growth_pct: Decimal) -> dict[int, Decimal]:
    """Compound the starting population across the forecast years."""
    growth_factor = 1 + annual_growth_pct / Decimal(100)
    return {
        year: start_population * growth_factor ** (year - FORECAST_START_YEAR)
        for year in FORECAST_YEARS
    }


def generate_base_assumptions() -> ForecastInput:
    """Build the initial Base scenario inputs for all ten forecast years."""
    population = project_population(BASE_PREVALENT_PATIENTS, BASE_POPULATION_GROWTH_PCT)
    return ForecastInput(
        years=[
            YearInput(
                year=year,
                prevalent_patients=population[year],
                diagnosed_pct=BASE_DIAGNOSED_PCT,
                drug_treated_pct=BASE_DRUG_TREATED_PCT,
                eligible_pct=BASE_ELIGIBLE_PCT,
                peak_brand_share_pct=BASE_PEAK_BRAND_SHARE_PCT,
                uptake_pct=BASE_UPTAKE_PCT[year],
                compliance_pct=BASE_COMPLIANCE_PCT,
                annual_price=BASE_ANNUAL_PRICE,
                gross_to_net_pct=BASE_GROSS_TO_NET_PCT,
            )
            for year in FORECAST_YEARS
        ]
    )
