from sqlalchemy import func, select

from app.db_models import Role, Scenario, ScenarioYearInput, User
from app.seed import BRAND_LEAD_EMAIL, FORECASTER_EMAIL, seed


def counts(db) -> tuple[int, int, int]:
    return (
        db.scalar(select(func.count()).select_from(User)),
        db.scalar(select(func.count()).select_from(Scenario)),
        db.scalar(select(func.count()).select_from(ScenarioYearInput)),
    )


def test_seed_creates_one_user_per_role(db):
    roles = {u.email: u.role for u in db.scalars(select(User))}

    assert roles == {FORECASTER_EMAIL: Role.FORECASTER, BRAND_LEAD_EMAIL: Role.BRAND_LEAD}


def test_seed_creates_three_scenarios_with_their_own_rows(db):
    scenarios = db.scalars(select(Scenario).order_by(Scenario.id)).all()

    assert [s.name for s in scenarios] == ["Base", "Upside", "Downside"]
    assert all(len(s.year_inputs) == 10 for s in scenarios)
    row_ids = {row.id for s in scenarios for row in s.year_inputs}
    assert len(row_ids) == 30


def test_seed_is_idempotent(db):
    before = counts(db)

    seed(db)
    seed(db)

    assert counts(db) == before == (2, 3, 30)
