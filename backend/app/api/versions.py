from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession, Forecaster
from app.db_models import Comment, ForecastVersion
from app.schemas import CommentCreate, CommentOut, VersionCreate, VersionDetail, VersionSummary
from app.services import versions as service

router = APIRouter(prefix="/api/versions", tags=["versions"])


@router.get("", response_model=list[VersionSummary])
def list_versions(db: DbSession, _: CurrentUser) -> list[ForecastVersion]:
    return service.list_versions(db)


@router.post("", response_model=VersionDetail, status_code=status.HTTP_201_CREATED)
def create_version(
    db: DbSession, user: Forecaster, body: VersionCreate | None = None
) -> ForecastVersion:
    return service.create_version(db, comment=body.comment if body else None, user=user)


@router.get("/{version_id}", response_model=VersionDetail)
def get_version(version_id: int, db: DbSession, _: CurrentUser) -> ForecastVersion:
    return service.get_version(db, version_id)


@router.get("/{version_id}/comments", response_model=list[CommentOut])
def list_comments(version_id: int, db: DbSession, _: CurrentUser) -> list[Comment]:
    return service.list_comments(db, version_id)


@router.post(
    "/{version_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
def add_comment(version_id: int, body: CommentCreate, db: DbSession, user: CurrentUser) -> Comment:
    return service.add_comment(db, version_id, content=body.content, user=user)
