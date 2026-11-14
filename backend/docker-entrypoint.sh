#!/bin/sh
# Container startup: wait for PostgreSQL, apply migrations, seed demo data, then serve the API.
set -eu

echo "Waiting for the database..."
python - <<'PY'
import sys
import time

from sqlalchemy import create_engine, text

from app.config import get_database_url

engine = create_engine(get_database_url())
for attempt in range(60):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        break
    except Exception as exc:  # noqa: BLE001 - any connection failure means "not ready yet"
        print(f"  database not ready ({type(exc).__name__}); retrying...", flush=True)
        time.sleep(1)
else:
    sys.exit("Database did not become available in time.")
PY

echo "Applying database migrations..."
alembic upgrade head

echo "Seeding demo users and scenarios (idempotent)..."
python -m app.seed

# Hosting platforms such as Render inject PORT; docker compose uses the default 8000.
PORT="${PORT:-8000}"
echo "Starting API on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --proxy-headers --forwarded-allow-ips="*"
