from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, Forecaster
from app.db_models import Scenario
from app.schemas import (
    ScenarioClone,
    ScenarioCreate,
    ScenarioDetail,
    ScenarioForecast,
    ScenarioSummary,
    ScenarioUpdate,
)
from app.services import scenarios as service

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


def _detail(scenario: Scenario) -> ScenarioDetail:
    return ScenarioDetail(
        **ScenarioSummary.model_validate(scenario).model_dump(),
        years=service.scenario_inputs(scenario).years,
    )


@router.get("", response_model=list[ScenarioSummary])
def list_scenarios(db: DbSession, _: CurrentUser) -> list[Scenario]:
    return service.list_scenarios(db)


@router.post("", response_model=ScenarioDetail, status_code=status.HTTP_201_CREATED)
def create_scenario(body: ScenarioCreate, db: DbSession, user: Forecaster) -> ScenarioDetail:
    scenario = service.create_scenario(
        db, name=body.name, description=body.description, years=body.years, user=user
    )
    return _detail(scenario)


@router.get("/{scenario_id}", response_model=ScenarioDetail)
def get_scenario(scenario_id: int, db: DbSession, _: CurrentUser) -> ScenarioDetail:
    return _detail(service.get_scenario(db, scenario_id))


@router.put("/{scenario_id}", response_model=ScenarioDetail)
def update_scenario(
    scenario_id: int, body: ScenarioUpdate, db: DbSession, _: Forecaster
) -> ScenarioDetail:
    scenario = service.get_scenario(db, scenario_id)
    return _detail(service.update_scenario(db, scenario, body))


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(scenario_id: int, db: DbSession, _: Forecaster) -> None:
    service.delete_scenario(db, service.get_scenario(db, scenario_id))


@router.post(
    "/{scenario_id}/clone", response_model=ScenarioDetail, status_code=status.HTTP_201_CREATED
)
def clone_scenario(
    scenario_id: int, db: DbSession, user: Forecaster, body: ScenarioClone | None = None
) -> ScenarioDetail:
    source = service.get_scenario(db, scenario_id)
    clone = service.clone_scenario(db, source, name=body.name if body else None, user=user)
    return _detail(clone)


@router.get("/{scenario_id}/forecast", response_model=ScenarioForecast)
def get_scenario_forecast(scenario_id: int, db: DbSession, _: CurrentUser) -> ScenarioForecast:
    scenario = service.get_scenario(db, scenario_id)
    return ScenarioForecast(scenario_id=scenario.id, years=service.scenario_forecast(scenario).years)
