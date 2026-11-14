from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.api import auth, scenarios, versions
from app.config import get_auth_settings
from app.errors import NotFoundError


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_auth_settings()  # Fail fast at startup if JWT_SECRET is missing or too short.
    yield


app = FastAPI(title="PharmSight Forecast API", version="0.2.0", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(scenarios.router)
app.include_router(versions.router)


@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})
