import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import auth, scenarios, versions
from app.api.deps import DbSession
from app.config import get_auth_settings
from app.errors import NotFoundError
from app.spa import mount_spa


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_auth_settings()  # Fail fast at startup if JWT_SECRET is missing or too short.
    yield


app = FastAPI(title="PharmSight Forecast API", version="0.2.0", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(scenarios.router)
app.include_router(versions.router)


@app.get("/api/health", tags=["health"])
def health(db: DbSession) -> dict[str, str]:
    """Unauthenticated liveness check used by the container healthcheck; also verifies the database."""
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})


# Single-service hosting: also serve the React build. Registered last so API routes take priority.
if static_dir := os.getenv("STATIC_DIR"):
    mount_spa(app, Path(static_dir))
