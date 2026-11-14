"""SQLAlchemy ORM models.

Column names on ScenarioYearInput match the fields of the forecast engine's
YearInput model so rows convert directly with YearInput.model_validate(row, from_attributes=True).
"""

import enum
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.forecast.models import FORECAST_END_YEAR, FORECAST_START_YEAR

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


class Role(str, enum.Enum):
    FORECASTER = "FORECASTER"
    BRAND_LEAD = "BRAND_LEAD"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    year_inputs: Mapped[list["ScenarioYearInput"]] = relationship(
        back_populates="scenario",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ScenarioYearInput.year",
    )


class ScenarioYearInput(Base):
    __tablename__ = "scenario_year_inputs"
    __table_args__ = (
        UniqueConstraint("scenario_id", "year"),
        CheckConstraint(
            f"year BETWEEN {FORECAST_START_YEAR} AND {FORECAST_END_YEAR}", name="year_range"
        ),
        *(CheckConstraint(f"{col} BETWEEN 0 AND 100", name=f"{col}_range") for col in PERCENTAGE_COLUMNS),
        *(CheckConstraint(f"{col} >= 0", name=f"{col}_non_negative") for col in NON_NEGATIVE_COLUMNS),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"))
    year: Mapped[int]
    # Unbounded NUMERIC preserves full Decimal precision.
    prevalent_patients: Mapped[Decimal] = mapped_column(Numeric)
    diagnosed_pct: Mapped[Decimal] = mapped_column(Numeric)
    drug_treated_pct: Mapped[Decimal] = mapped_column(Numeric)
    eligible_pct: Mapped[Decimal] = mapped_column(Numeric)
    peak_brand_share_pct: Mapped[Decimal] = mapped_column(Numeric)
    uptake_pct: Mapped[Decimal] = mapped_column(Numeric)
    compliance_pct: Mapped[Decimal] = mapped_column(Numeric)
    annual_price: Mapped[Decimal] = mapped_column(Numeric)
    gross_to_net_pct: Mapped[Decimal] = mapped_column(Numeric)

    scenario: Mapped[Scenario] = relationship(back_populates="year_inputs")


class ForecastVersion(Base):
    """An immutable snapshot of the whole workspace. Has no FK to scenarios by design."""

    __tablename__ = "forecast_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    comment: Mapped[str | None] = mapped_column(Text)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)

    author: Mapped[User] = relationship(lazy="joined")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("forecast_versions.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    author: Mapped[User] = relationship(lazy="joined")
