"""Initial schema: users, scenarios, scenario year inputs, forecast versions, comments.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-14
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

PERCENTAGE_COLUMNS = (
    "diagnosed_pct",
    "drug_treated_pct",
    "eligible_pct",
    "peak_brand_share_pct",
    "uptake_pct",
    "compliance_pct",
    "gross_to_net_pct",
)
NON_NEGATIVE_COLUMNS = ("prevalent_patients", "annual_price")


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("FORECASTER", "BRAND_LEAD", name="user_role"), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )

    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        _created_at(),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scenarios")),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_scenarios_created_by_users")
        ),
    )

    op.create_table(
        "scenario_year_inputs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scenario_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("prevalent_patients", sa.Numeric(), nullable=False),
        sa.Column("diagnosed_pct", sa.Numeric(), nullable=False),
        sa.Column("drug_treated_pct", sa.Numeric(), nullable=False),
        sa.Column("eligible_pct", sa.Numeric(), nullable=False),
        sa.Column("peak_brand_share_pct", sa.Numeric(), nullable=False),
        sa.Column("uptake_pct", sa.Numeric(), nullable=False),
        sa.Column("compliance_pct", sa.Numeric(), nullable=False),
        sa.Column("annual_price", sa.Numeric(), nullable=False),
        sa.Column("gross_to_net_pct", sa.Numeric(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scenario_year_inputs")),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["scenarios.id"],
            name=op.f("fk_scenario_year_inputs_scenario_id_scenarios"),
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "scenario_id", "year", name=op.f("uq_scenario_year_inputs_scenario_id_year")
        ),
        sa.CheckConstraint(
            "year BETWEEN 2027 AND 2036", name=op.f("ck_scenario_year_inputs_year_range")
        ),
        *(
            sa.CheckConstraint(
                f"{col} BETWEEN 0 AND 100", name=op.f(f"ck_scenario_year_inputs_{col}_range")
            )
            for col in PERCENTAGE_COLUMNS
        ),
        *(
            sa.CheckConstraint(
                f"{col} >= 0", name=op.f(f"ck_scenario_year_inputs_{col}_non_negative")
            )
            for col in NON_NEGATIVE_COLUMNS
        ),
    )

    op.create_table(
        "forecast_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        _created_at(),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_forecast_versions")),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_forecast_versions_created_by_users")
        ),
    )

    # Saved versions are historical records: the database itself refuses to change or remove them.
    op.execute(
        """
        CREATE FUNCTION forbid_forecast_version_changes() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'forecast_versions rows are immutable';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER forecast_versions_immutable
        BEFORE UPDATE OR DELETE ON forecast_versions
        FOR EACH ROW EXECUTE FUNCTION forbid_forecast_version_changes();
        """
    )

    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        _created_at(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_comments")),
        sa.ForeignKeyConstraint(
            ["version_id"],
            ["forecast_versions.id"],
            name=op.f("fk_comments_version_id_forecast_versions"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_comments_user_id_users")),
    )
    op.create_index(op.f("ix_comments_version_id"), "comments", ["version_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_comments_version_id"), table_name="comments")
    op.drop_table("comments")
    op.execute("DROP TRIGGER forecast_versions_immutable ON forecast_versions")
    op.execute("DROP FUNCTION forbid_forecast_version_changes()")
    op.drop_table("forecast_versions")
    op.drop_table("scenario_year_inputs")
    op.drop_table("scenarios")
    op.drop_table("users")
    op.execute("DROP TYPE user_role")
