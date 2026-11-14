"""Fixtures for API/integration tests, which run against a real PostgreSQL database.

Set TEST_DATABASE_URL to point elsewhere; the default matches docker-compose.yml.
If the database is unreachable these tests are skipped (the reason is shown in the summary).
"""

import os
from pathlib import Path

os.environ.setdefault("JWT_SECRET", "test-only-secret-key-for-launchlens-api-tests")

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.db_models import User
from app.forecast import generate_base_assumptions
from app.main import app
from app.security import create_access_token
from app.seed import BRAND_LEAD_EMAIL, FORECASTER_EMAIL, seed

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://launchlens:launchlens@127.0.0.1:55432/launchlens_test"
)
ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    return config


@pytest.fixture(scope="session")
def engine(alembic_config):
    # A connect timeout turns an unreachable database into a clear skip instead of a hang.
    engine = create_engine(TEST_DATABASE_URL, connect_args={"connect_timeout": 10})
    try:
        engine.connect().close()
    except OperationalError as exc:
        engine.dispose()
        pytest.skip(
            f"PostgreSQL not reachable at {engine.url.render_as_string(hide_password=True)}: {exc.orig}"
        )

    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    command.upgrade(alembic_config, "head")

    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(engine):
    """Reset workspace data, then seed. Users survive between tests (seeding is idempotent)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE comments, forecast_versions, scenario_year_inputs, scenarios "
                "RESTART IDENTITY CASCADE"
            )
        )
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        seed(db)
    return factory


@pytest.fixture
def db(session_factory):
    with session_factory() as session:
        yield session


@pytest.fixture
def client(session_factory):
    def _get_test_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _user_id(session_factory, email: str) -> int:
    with session_factory() as db:
        return db.scalar(select(User.id).where(User.email == email))


@pytest.fixture
def forecaster_id(session_factory) -> int:
    return _user_id(session_factory, FORECASTER_EMAIL)


@pytest.fixture
def brand_lead_id(session_factory) -> int:
    return _user_id(session_factory, BRAND_LEAD_EMAIL)


@pytest.fixture
def forecaster_headers(forecaster_id) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(forecaster_id)}"}


@pytest.fixture
def brand_lead_headers(brand_lead_id) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(brand_lead_id)}"}


def base_years_payload() -> list[dict]:
    """The Base assumptions as JSON-ready year rows."""
    return [year.model_dump(mode="json") for year in generate_base_assumptions().years]


def scenario_payload(name: str = "New scenario", description: str | None = None, **year_overrides) -> dict:
    years = [{**year, **year_overrides} for year in base_years_payload()]
    return {"name": name, "description": description, "years": years}
