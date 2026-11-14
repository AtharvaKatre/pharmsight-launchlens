"""Application settings read from environment variables.

For local development, values can also live in backend/.env (see .env.example). Real environment
variables always take precedence over the file, so Docker/CI/production configuration is unaffected.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Every entry point (API, Alembic, seed command, tests) imports this module, so loading here covers all.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

MIN_JWT_SECRET_LENGTH = 32


def normalize_database_url(url: str) -> str:
    """Use the psycopg (v3) driver for plain postgres URLs, as provided by hosts such as Render."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


def get_database_url() -> str:
    return normalize_database_url(
        # Default matches the host port docker-compose.yml publishes for the database.
        os.getenv("DATABASE_URL", "postgresql+psycopg://launchlens:launchlens@127.0.0.1:55432/launchlens")
    )


@dataclass(frozen=True)
class AuthSettings:
    jwt_secret: str
    jwt_algorithm: str
    access_token_expire_minutes: int


@lru_cache
def get_auth_settings() -> AuthSettings:
    jwt_secret = os.getenv("JWT_SECRET", "")
    if len(jwt_secret) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET environment variable must be set to at least {MIN_JWT_SECRET_LENGTH} characters"
        )
    return AuthSettings(
        jwt_secret=jwt_secret,
        jwt_algorithm="HS256",
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")),
    )
