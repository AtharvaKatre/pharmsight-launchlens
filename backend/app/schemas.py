"""API request/response models. Scenario inputs reuse the forecast engine's models."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.db_models import Role
from app.forecast import ForecastInput, ForecastResult, YearInput, YearResult, generate_base_assumptions

SCENARIO_NAME_MAX_LENGTH = 200

ScenarioName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=SCENARIO_NAME_MAX_LENGTH)
]
OptionalText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None


# --- Auth ------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=320)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=1024)]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: Role
    created_at: datetime


# --- Scenarios -------------------------------------------------------------


class ScenarioUpdate(ForecastInput):
    """Full replacement of a scenario. Inherits the ten-year validation from ForecastInput."""

    name: ScenarioName
    description: OptionalText = None


class ScenarioCreate(ScenarioUpdate):
    """Like ScenarioUpdate, but years default to the Base assumptions when omitted."""

    years: list[YearInput] = Field(default_factory=lambda: generate_base_assumptions().years)


class ScenarioClone(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ScenarioName | None = None


class ScenarioSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_by: int
    created_at: datetime
    updated_at: datetime


class ScenarioDetail(ScenarioSummary):
    years: list[YearInput]


class ScenarioForecast(ForecastResult):
    scenario_id: int


# --- Versions and comments -------------------------------------------------


class ScenarioSnapshot(BaseModel):
    scenario_id: int
    name: str
    description: str | None
    years: list[YearInput]
    forecast: list[YearResult]


class WorkspaceSnapshot(BaseModel):
    scenarios: list[ScenarioSnapshot]


class VersionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: OptionalText = None


class UserPublic(BaseModel):
    """The non-sensitive identity shown next to versions and comments."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: Role


class VersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: int
    author: UserPublic
    created_at: datetime
    comment: str | None


class VersionDetail(VersionSummary):
    snapshot: WorkspaceSnapshot


class CommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_id: int
    user_id: int
    author: UserPublic
    content: str
    created_at: datetime
