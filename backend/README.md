# PharmSight Backend

The drug revenue forecast engine (Phase 1), plus PostgreSQL persistence and a FastAPI REST API
(Phase 2). There is no frontend yet.

## Structure

```
backend/
├── app/
│   ├── forecast/          # Phase 1 engine. Pure calculations; no database, API or UI code
│   │   ├── models.py      #   YearInput / ForecastInput (validation), YearResult / ForecastResult
│   │   ├── engine.py      #   calculate_forecast(): patient funnel → gross and net revenue
│   │   └── base_case.py   #   Base assumptions and generate_base_assumptions()
│   ├── api/               # FastAPI routers and dependencies (auth, role checks)
│   ├── services/          # Business logic between the API and the database
│   ├── db_models.py       # SQLAlchemy models
│   ├── schemas.py         # API request/response models (scenario inputs reuse YearInput / ForecastInput)
│   ├── security.py        # Argon2 password hashing, JWT tokens
│   ├── seed.py            # Demo users and the Base / Upside / Downside scenarios
│   └── main.py            # FastAPI app
├── alembic/               # Database migrations
└── tests/                 # Engine unit tests; tests/api/ holds API and integration tests (need PostgreSQL)
```

## Setup

You need Python 3.11+ and Docker.

```bash
# 1. Start PostgreSQL (from the repository root). This creates the pharmsight and pharmsight_test databases.
docker compose up -d db

# 2. Install dependencies (from backend/)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

# 3. Configure: copy .env.example to .env and set JWT_SECRET (at least 32 characters).
#    The backend loads .env automatically; real environment variables take precedence over it.
cp .env.example .env                                         # PowerShell: Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))" # paste the output into JWT_SECRET

# 4. Create the schema and load the demo data
alembic upgrade head
python -m app.seed

# 5. Run the API
uvicorn app.main:app --reload
```

Interactive API docs: http://localhost:8000/docs. Log in through `POST /api/auth/login`, then
paste the `access_token` into **Authorize**.

`DATABASE_URL` defaults to `postgresql+psycopg://pharmsight:pharmsight@localhost:5432/pharmsight`,
which matches `docker-compose.yml`.

If another Postgres is already using port 5432, choose a different host port. Put
`PHARMSIGHT_DB_PORT=5434` in a `.env` next to `docker-compose.yml` (Compose reads it automatically),
then use port 5434 in `DATABASE_URL` and `TEST_DATABASE_URL` in `backend/.env`. Both `.env` files
are git-ignored.

## Demo credentials

| Role       | Email                    | Password         |
|------------|--------------------------|------------------|
| Forecaster | `forecaster@example.com` | `Forecaster123!` |
| Brand Lead | `brandlead@example.com`  | `BrandLead123!`  |

These are demo-only accounts created by `python -m app.seed`. Don't run the seed command against a
production database.

## Running the tests

```bash
python -m pytest
```

- **Engine tests** (`tests/test_*.py`) don't need a database.
- **API and integration tests** (`tests/api/`) run against real PostgreSQL at `TEST_DATABASE_URL`
  (default: the `pharmsight_test` database from `docker compose`). The suite drops and recreates the
  schema in that database through Alembic. If PostgreSQL isn't reachable, these tests are **skipped**,
  and the reason is printed in the test summary.

## API

All endpoints except login require `Authorization: Bearer <token>`.

| Method | Path                           | Forecaster | Brand Lead |
|--------|--------------------------------|:----------:|:----------:|
| POST   | `/api/auth/login`              | ✓          | ✓          |
| GET    | `/api/auth/me`                 | ✓          | ✓          |
| GET    | `/api/scenarios`               | ✓          | ✓          |
| POST   | `/api/scenarios`               | ✓          | 403        |
| GET    | `/api/scenarios/{id}`          | ✓          | ✓          |
| PUT    | `/api/scenarios/{id}`          | ✓          | 403        |
| DELETE | `/api/scenarios/{id}`          | ✓          | 403        |
| POST   | `/api/scenarios/{id}/clone`    | ✓          | 403        |
| GET    | `/api/scenarios/{id}/forecast` | ✓          | ✓          |
| GET    | `/api/versions`                | ✓          | ✓          |
| POST   | `/api/versions`                | ✓          | 403        |
| GET    | `/api/versions/{id}`           | ✓          | ✓          |
| GET    | `/api/versions/{id}/comments`  | ✓          | ✓          |
| POST   | `/api/versions/{id}/comments`  | ✓          | ✓          |

Roles are enforced on the server through FastAPI dependencies (`app/api/deps.py`).

Status codes: `401` missing, invalid or expired token · `403` wrong role · `404` unknown id ·
`422` validation error · `201` created · `204` deleted.

### Scenarios

- `POST` and `PUT` take `{name, description?, years: [...]}`. `years` must contain exactly one entry
  for each year from 2027 to 2036, validated by the engine's `ForecastInput`. `PUT` replaces the
  whole scenario. When `POST` has no `years`, the scenario starts from the Base assumptions.
- `POST /clone` takes an optional `{name}`. Without it, the clone is named "<source> (copy)".
- Each scenario owns its own input rows, so editing one scenario never changes another.
- `GET /forecast` runs the stored inputs through `calculate_forecast()`.

### Versions

`POST /api/versions` (body: optional `{comment}`) stores a snapshot of the whole workspace: every
scenario's name, description, ten annual inputs and calculated results. Snapshots don't reference
scenario rows, so later edits or deletions never change them. A database trigger also rejects any
`UPDATE` or `DELETE` on `forecast_versions`.

### Numbers

Inputs and results are stored and returned at full precision. Database columns use unbounded
`NUMERIC`, and JSON values are decimal **strings** so no precision is lost. Results keep the trailing
zeros from the calculation, so the 2027 Base net revenue comes back as `"28800000.00000000"`. Rounding
is left to the presentation layer.
