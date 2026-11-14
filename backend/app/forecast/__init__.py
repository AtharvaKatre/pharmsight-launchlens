"""Forecast engine: pure calculation logic, independent of API, database and UI."""

from app.forecast.base_case import generate_base_assumptions, project_population
from app.forecast.engine import calculate_forecast, calculate_year
from app.forecast.models import (
    FORECAST_YEARS,
    ForecastInput,
    ForecastResult,
    YearInput,
    YearResult,
)

__all__ = [
    "FORECAST_YEARS",
    "ForecastInput",
    "ForecastResult",
    "YearInput",
    "YearResult",
    "calculate_forecast",
    "calculate_year",
    "generate_base_assumptions",
    "project_population",
]
