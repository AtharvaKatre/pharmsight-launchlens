"""Forecast versions (immutable workspace snapshots) and their comments."""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db_models import Comment, ForecastVersion, Scenario, User
from app.errors import NotFoundError
from app.schemas import ScenarioSnapshot, WorkspaceSnapshot
from app.services.scenarios import scenario_inputs
from app.forecast import calculate_forecast


def build_workspace_snapshot(db: Session) -> WorkspaceSnapshot:
    # A single joined query reads scenarios and their inputs from one consistent database snapshot.
    scenarios = (
        db.scalars(
            select(Scenario).options(joinedload(Scenario.year_inputs)).order_by(Scenario.id)
        )
        .unique()
        .all()
    )
    snapshots = []
    for scenario in scenarios:
        inputs = scenario_inputs(scenario)
        snapshots.append(
            ScenarioSnapshot(
                scenario_id=scenario.id,
                name=scenario.name,
                description=scenario.description,
                years=inputs.years,
                forecast=calculate_forecast(inputs).years,
            )
        )
    return WorkspaceSnapshot(scenarios=snapshots)


def create_version(db: Session, *, comment: str | None, user: User) -> ForecastVersion:
    version = ForecastVersion(
        created_by=user.id,
        comment=comment or None,
        # mode="json" stores Decimals as strings, so no precision is lost in JSONB.
        snapshot=build_workspace_snapshot(db).model_dump(mode="json"),
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def list_versions(db: Session) -> list[ForecastVersion]:
    return list(
        db.scalars(
            select(ForecastVersion).order_by(
                ForecastVersion.created_at.desc(), ForecastVersion.id.desc()
            )
        )
    )


def get_version(db: Session, version_id: int) -> ForecastVersion:
    version = db.get(ForecastVersion, version_id)
    if version is None:
        raise NotFoundError(f"Version {version_id} not found")
    return version


def list_comments(db: Session, version_id: int) -> list[Comment]:
    get_version(db, version_id)
    return list(
        db.scalars(
            select(Comment)
            .where(Comment.version_id == version_id)
            .order_by(Comment.created_at, Comment.id)
        )
    )


def add_comment(db: Session, version_id: int, *, content: str, user: User) -> Comment:
    get_version(db, version_id)
    comment = Comment(version_id=version_id, user_id=user.id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
