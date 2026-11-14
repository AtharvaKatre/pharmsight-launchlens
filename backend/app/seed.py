"""Idempotent demo data: two demo users and the Base, Upside and Downside scenarios.

Run with: python -m app.seed

Scenarios are only created when the workspace has none, so re-running never overwrites user edits.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.db_models import Role, Scenario, User
from app.forecast import YearInput, generate_base_assumptions
from app.security import hash_password
from app.services.scenarios import create_scenario

FORECASTER_EMAIL = "forecaster@example.com"
FORECASTER_PASSWORD = "Forecaster123!"
BRAND_LEAD_EMAIL = "brandlead@example.com"
BRAND_LEAD_PASSWORD = "BrandLead123!"

DEMO_USERS = (
    (FORECASTER_EMAIL, FORECASTER_PASSWORD, Role.FORECASTER),
    (BRAND_LEAD_EMAIL, BRAND_LEAD_PASSWORD, Role.BRAND_LEAD),
)


@dataclass(frozen=True)
class ScenarioOverrides:
    """Inputs that differ from Base. Uptake lists Y1, Y2, ...; the last value continues to 2036."""

    peak_brand_share_pct: str
    uptake_pct: tuple[str, ...]
    gross_to_net_pct: str


# SYNTHETIC, ILLUSTRATIVE assumptions for demonstration only. They were chosen for this demo and
# were NOT supplied by the assignment (which only defines the Base case). Every other input is
# identical to Base. These are plain input values: the forecast engine has no scenario-specific logic.
INITIAL_SCENARIOS: tuple[tuple[str, str, ScenarioOverrides | None], ...] = (
    ("Base", "Base case assumptions", None),
    (
        "Upside",
        "Illustrative upside: 25% peak share, faster uptake",
        ScenarioOverrides("25", ("15", "40", "65", "85", "100"), "25"),
    ),
    (
        "Downside",
        "Illustrative downside: 15% peak share, slower uptake, 30% gross-to-net",
        ScenarioOverrides("15", ("5", "20", "40", "65", "85"), "30"),
    ),
)


def apply_overrides(years: list[YearInput], overrides: ScenarioOverrides | None) -> list[YearInput]:
    if overrides is None:
        return years
    curve = overrides.uptake_pct
    return [
        YearInput.model_validate(
            {
                **year.model_dump(),
                "peak_brand_share_pct": Decimal(overrides.peak_brand_share_pct),
                "uptake_pct": Decimal(curve[min(index, len(curve) - 1)]),
                "gross_to_net_pct": Decimal(overrides.gross_to_net_pct),
            }
        )
        for index, year in enumerate(years)
    ]


def initial_scenario_years(name: str) -> list[YearInput]:
    """The seeded inputs for one of the initial scenarios."""
    overrides = next(o for n, _, o in INITIAL_SCENARIOS if n == name)
    return apply_overrides(generate_base_assumptions().years, overrides)


def seed(db: Session) -> None:
    users: dict[Role, User] = {}
    for email, password, role in DEMO_USERS:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, password_hash=hash_password(password), role=role)
            db.add(user)
        users[role] = user
    db.commit()

    if db.scalar(select(func.count()).select_from(Scenario)) == 0:
        for name, description, _ in INITIAL_SCENARIOS:
            create_scenario(
                db,
                name=name,
                description=description,
                years=initial_scenario_years(name),
                user=users[Role.FORECASTER],
            )


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
    print("Seed complete.")
