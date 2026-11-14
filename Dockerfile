# Single-image build for hosting (used by render.yaml): FastAPI serves both the API and the React build.
# Local development uses docker-compose.yml instead (separate nginx frontend, API and database).

# --- Build the React app ---
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Show the demo-account hint on the login page of the hosted demo.
ARG VITE_SHOW_DEMO_ACCOUNTS=true
ENV VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN npm run build

# --- API + static files ---
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore \
    STATIC_DIR=/app/static

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/app ./app
COPY backend/docker-entrypoint.sh ./
COPY --from=frontend /frontend/dist ./static

RUN useradd --create-home --uid 10001 appuser && chmod +x docker-entrypoint.sh
USER appuser

# The platform injects PORT (Render uses 10000); docker-entrypoint.sh defaults to 8000.
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
