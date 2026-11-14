"""Pure forecast calculation. No business assumptions, I/O or rounding live here."""

from decimal import Decimal

from app.forecast.models import ForecastInput, ForecastResult, YearInput, YearResult

_HUNDRED = Decimal(100)


def _fraction(pct: Decimal) -> Decimal:
    return pct / _HUNDRED


def calculate_year(inputs: YearInput) -> YearResult:
    """Run the patient funnel for one year."""
    diagnosed = inputs.prevalent_patients * _fraction(inputs.diagnosed_pct)
    drug_treated = diagnosed * _fraction(inputs.drug_treated_pct)
    eligible = drug_treated * _fraction(inputs.eligible_pct)
    peak_brand = eligible * _fraction(inputs.peak_brand_share_pct)
    on_drug = peak_brand * _fraction(inputs.uptake_pct)
    compliant = on_drug * _fraction(inputs.compliance_pct)
    gross_revenue = compliant * inputs.annual_price
    net_revenue = gross_revenue * (1 - _fraction(inputs.gross_to_net_pct))

    return YearResult(
        year=inputs.year,
        prevalent_patients=inputs.prevalent_patients,
        diagnosed_patients=diagnosed,
        drug_treated_patients=drug_treated,
        eligible_patients=eligible,
        peak_brand_patients=peak_brand,
        patients_on_drug=on_drug,
        compliant_patients=compliant,
        gross_revenue=gross_revenue,
        net_revenue=net_revenue,
    )


def calculate_forecast(inputs: ForecastInput) -> ForecastResult:
    """Run the patient funnel for every forecast year."""
    return ForecastResult(years=[calculate_year(year) for year in inputs.years])
