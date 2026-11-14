"""Idempotent demo data: two demo users and the Base, Upside and Downside scenarios.

Run with: python -m app.seed
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.db_models import Role, Scenario, User
from app.forecast import generate_base_assumptions
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

# Upside and Downside start as copies of Base; forecasters adjust them afterwards.
INITIAL_SCENARIOS = (
    ("Base", "Base case assumptions"),
    ("Upside", "Upside case (initialised from Base)"),
    ("Downside", "Downside case (initialised from Base)"),
)


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
        base = generate_base_assumptions()
        for name, description in INITIAL_SCENARIOS:
            create_scenario(
                db, name=name, description=description, years=base.years, user=users[Role.FORECASTER]
            )


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
    print("Seed complete.")
