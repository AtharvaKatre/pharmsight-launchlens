from decimal import Decimal

from app.forecast.base_case import BASE_UPTAKE_PCT, generate_base_assumptions
from app.forecast.engine import calculate_forecast, calculate_year
from app.forecast.models import FORECAST_YEARS, ForecastInput


def test_worked_example_single_year(make_year):
    result = calculate_year(make_year())

    assert result.prevalent_patients == Decimal("2000000")
    assert result.diagnosed_patients == Decimal("1200000")
    assert result.drug_treated_patients == Decimal("600000")
    assert result.eligible_patients == Decimal("240000")
    assert result.peak_brand_patients == Decimal("48000")
    assert result.patients_on_drug == Decimal("48000")
    assert result.compliant_patients == Decimal("38400")
    assert result.gross_revenue == Decimal("384000000")
    assert result.net_revenue == Decimal("288000000")


def test_worked_example_across_all_years(make_forecast_input):
    result = calculate_forecast(make_forecast_input())

    assert [y.year for y in result.years] == list(FORECAST_YEARS)
    for year in result.years:
        assert year.patients_on_drug == Decimal("48000")
        assert year.gross_revenue == Decimal("384000000")
        assert year.net_revenue == Decimal("288000000")


def test_uptake_progression_scales_patients_on_drug(make_forecast_input):
    # Same funnel every year (growth disabled), uptake follows the base ramp.
    inputs = make_forecast_input()
    for year in inputs.years:
        year.uptake_pct = BASE_UPTAKE_PCT[year.year]

    result = {y.year: y for y in calculate_forecast(inputs).years}

    expected_on_drug = {
        2027: Decimal("4800"),
        2028: Decimal("14400"),
        2029: Decimal("26400"),
        2030: Decimal("38400"),
    }
    expected_on_drug.update({year: Decimal("48000") for year in range(2031, 2037)})

    for year, expected in expected_on_drug.items():
        assert result[year].peak_brand_patients == Decimal("48000")
        assert result[year].patients_on_drug == expected

    on_drug = [result[y].patients_on_drug for y in FORECAST_YEARS]
    assert on_drug == sorted(on_drug)


def test_base_case_forecast_end_to_end():
    result = {y.year: y for y in calculate_forecast(generate_base_assumptions()).years}

    # 2027: 2,000,000 population, 10% uptake.
    assert result[2027].patients_on_drug == Decimal("4800")
    assert result[2027].gross_revenue == Decimal("38400000")
    assert result[2027].net_revenue == Decimal("28800000")

    # 2031: population 2,000,000 x 1.01^4, 100% uptake.
    population_2031 = Decimal("2000000") * Decimal("1.01") ** 4
    assert result[2031].prevalent_patients == population_2031
    assert result[2031].net_revenue == population_2031 * Decimal("144")


def test_results_are_not_rounded(make_year):
    result = calculate_year(make_year(prevalent_patients=Decimal("1000001")))

    # 1,000,001 x 0.6 x 0.5 x 0.4 x 0.2 = 24,000.024
    assert result.peak_brand_patients == Decimal("24000.024")
    assert result.net_revenue == Decimal("144000144")


def test_each_year_population_is_independently_editable(make_forecast_input):
    inputs = make_forecast_input()
    inputs.years[3].prevalent_patients = Decimal("3000000")  # 2030 only

    result = {y.year: y for y in calculate_forecast(inputs).years}

    assert result[2030].patients_on_drug == Decimal("72000")
    for year in FORECAST_YEARS:
        if year != 2030:
            assert result[year].patients_on_drug == Decimal("48000")


def test_years_are_returned_in_order_regardless_of_input_order(make_year):
    inputs = ForecastInput(years=[make_year(year) for year in reversed(FORECAST_YEARS)])

    result = calculate_forecast(inputs)

    assert [y.year for y in result.years] == list(FORECAST_YEARS)


def test_zero_diagnosed_zeroes_whole_funnel(make_year):
    result = calculate_year(make_year(diagnosed_pct=0))

    assert result.prevalent_patients == Decimal("2000000")
    assert result.diagnosed_patients == 0
    assert result.patients_on_drug == 0
    assert result.gross_revenue == 0
    assert result.net_revenue == 0


def test_zero_uptake_gives_zero_revenue(make_year):
    result = calculate_year(make_year(uptake_pct=0))

    assert result.peak_brand_patients == Decimal("48000")
    assert result.patients_on_drug == 0
    assert result.net_revenue == 0


def test_zero_price_gives_zero_revenue(make_year):
    result = calculate_year(make_year(annual_price=0))

    assert result.compliant_patients == Decimal("38400")
    assert result.gross_revenue == 0
    assert result.net_revenue == 0


def test_zero_population_gives_zero_everything(make_year):
    result = calculate_year(make_year(prevalent_patients=0))

    assert result.patients_on_drug == 0
    assert result.net_revenue == 0


def test_zero_gross_to_net_means_net_equals_gross(make_year):
    result = calculate_year(make_year(gross_to_net_pct=0))

    assert result.net_revenue == result.gross_revenue == Decimal("384000000")


def test_full_gross_to_net_discount_gives_zero_net(make_year):
    result = calculate_year(make_year(gross_to_net_pct=100))

    assert result.gross_revenue == Decimal("384000000")
    assert result.net_revenue == 0


def test_all_funnel_percentages_at_100_pass_population_through(make_year):
    result = calculate_year(
        make_year(
            diagnosed_pct=100,
            drug_treated_pct=100,
            eligible_pct=100,
            peak_brand_share_pct=100,
            uptake_pct=100,
            compliance_pct=100,
        )
    )

    assert result.patients_on_drug == Decimal("2000000")
    assert result.compliant_patients == Decimal("2000000")
    assert result.gross_revenue == Decimal("20000000000")
