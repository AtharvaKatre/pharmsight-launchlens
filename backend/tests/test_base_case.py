from decimal import Decimal

from app.forecast.base_case import generate_base_assumptions, project_population
from app.forecast.models import FORECAST_YEARS, ForecastInput


def test_base_assumptions_cover_all_ten_years():
    inputs = generate_base_assumptions()

    assert isinstance(inputs, ForecastInput)
    assert [y.year for y in inputs.years] == list(range(2027, 2037))


def test_base_population_grows_one_percent_per_year():
    population = {y.year: y.prevalent_patients for y in generate_base_assumptions().years}

    assert population[2027] == Decimal("2000000")
    assert population[2028] == Decimal("2020000")
    assert population[2029] == Decimal("2040200")
    assert population[2036] == Decimal("2000000") * Decimal("1.01") ** 9
    for year in FORECAST_YEARS[1:]:
        assert population[year] == population[year - 1] * Decimal("1.01")


def test_project_population_with_growth_disabled():
    population = project_population(Decimal("2000000"), Decimal("0"))

    assert list(population) == list(FORECAST_YEARS)
    assert all(value == Decimal("2000000") for value in population.values())


def test_base_uptake_progression():
    uptake = {y.year: y.uptake_pct for y in generate_base_assumptions().years}

    assert uptake == {
        2027: 10,
        2028: 30,
        2029: 55,
        2030: 80,
        2031: 100,
        2032: 100,
        2033: 100,
        2034: 100,
        2035: 100,
        2036: 100,
    }


def test_base_constant_assumptions_applied_to_every_year():
    for year in generate_base_assumptions().years:
        assert year.diagnosed_pct == 60
        assert year.drug_treated_pct == 50
        assert year.eligible_pct == 40
        assert year.peak_brand_share_pct == 20
        assert year.compliance_pct == 80
        assert year.annual_price == 10000
        assert year.gross_to_net_pct == 25
