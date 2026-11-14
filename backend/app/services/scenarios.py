"""Scenario persistence. Converts between ORM rows and the forecast engine's models."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db_models import Scenario, ScenarioYearInput, User
from app.errors import NotFoundError
from app.forecast import ForecastInput, ForecastResult, YearInput, calculate_forecast
from app.schemas import SCENARIO_NAME_MAX_LENGTH, ScenarioUpdate


def list_scenarios(db: Session) -> list[Scenario]:
    return list(db.scalars(select(Scenario).order_by(Scenario.id)))


def get_scenario(db: Session, scenario_id: int) -> Scenario:
    scenario = db.get(Scenario, scenario_id)
    if scenario is None:
        raise NotFoundError(f"Scenario {scenario_id} not found")
    return scenario


def scenario_inputs(scenario: Scenario) -> ForecastInput:
    """Load a scenario's rows into the engine's validated input model."""
    return ForecastInput(
        years=[YearInput.model_validate(row, from_attributes=True) for row in scenario.year_inputs]
    )


def scenario_forecast(scenario: Scenario) -> ForecastResult:
    return calculate_forecast(scenario_inputs(scenario))


def create_scenario(
    db: Session, *, name: str, description: str | None, years: list[YearInput], user: User
) -> Scenario:
    scenario = Scenario(
        name=name,
        description=description,
        created_by=user.id,
        year_inputs=[ScenarioYearInput(**year.model_dump()) for year in years],
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


def update_scenario(db: Session, scenario: Scenario, data: ScenarioUpdate) -> Scenario:
    scenario.name = data.name
    scenario.description = data.description
    scenario.updated_at = func.now()

    # Every scenario always holds one row per forecast year, so rows are updated in place.
    rows = {row.year: row for row in scenario.year_inputs}
    for year in data.years:
        row = rows[year.year]
        for field, value in year.model_dump(exclude={"year"}).items():
            setattr(row, field, value)

    db.commit()
    db.refresh(scenario)
    return scenario


def delete_scenario(db: Session, scenario: Scenario) -> None:
    db.delete(scenario)
    db.commit()


def clone_scenario(db: Session, source: Scenario, *, name: str | None, user: User) -> Scenario:
    return create_scenario(
        db,
        name=name or f"{source.name} (copy)"[:SCENARIO_NAME_MAX_LENGTH],
        description=source.description,
        years=scenario_inputs(source).years,
        user=user,
    )
