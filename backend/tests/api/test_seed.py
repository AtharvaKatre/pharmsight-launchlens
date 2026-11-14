from sqlalchemy import func, select

from app.db_models import Role, Scenario, ScenarioYearInput, User
from app.forecast import generate_base_assumptions
from app.seed import BRAND_LEAD_EMAIL, FORECASTER_EMAIL, initial_scenario_years, seed


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


def test_upside_and_downside_differ_from_base_only_in_their_overrides():
    base = generate_base_assumptions().years
    upside = initial_scenario_years("Upside")
    downside = initial_scenario_years("Downside")

    assert initial_scenario_years("Base") == base
    assert [y.uptake_pct for y in upside] == [15, 40, 65, 85, 100, 100, 100, 100, 100, 100]
    assert [y.uptake_pct for y in downside] == [5, 20, 40, 65, 85, 85, 85, 85, 85, 85]
    assert {y.peak_brand_share_pct for y in upside} == {25}
    assert {y.peak_brand_share_pct for y in downside} == {15}
    assert {y.gross_to_net_pct for y in upside} == {25}
    assert {y.gross_to_net_pct for y in downside} == {30}

    overridden = {"peak_brand_share_pct", "uptake_pct", "gross_to_net_pct"}
    for scenario in (upside, downside):
        for seeded, reference in zip(scenario, base):
            assert seeded.model_dump(exclude=overridden) == reference.model_dump(exclude=overridden)


def test_seed_is_idempotent(db):
    before = counts(db)

    seed(db)
    seed(db)

    assert counts(db) == before == (2, 3, 30)
