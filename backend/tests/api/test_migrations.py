from alembic import command
from sqlalchemy import inspect

APP_TABLES = {"users", "scenarios", "scenario_year_inputs", "forecast_versions", "comments"}


def test_orm_models_match_migrations(engine, alembic_config):
    # Raises if autogenerate would produce a new migration.
    command.check(alembic_config)


def test_migrations_downgrade_and_upgrade_cleanly(engine, alembic_config):
    command.downgrade(alembic_config, "base")
    assert APP_TABLES.isdisjoint(inspect(engine).get_table_names())

    command.upgrade(alembic_config, "head")
    assert APP_TABLES <= set(inspect(engine).get_table_names())
