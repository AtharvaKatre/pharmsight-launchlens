# LaunchLens: Drug Revenue Forecasting

**Live demo:** https://launchlens-2c6d.onrender.com. Sign in with the demo accounts below. It's on Render's
free tier, so the first visit after a while idle can take about a minute to wake up.

A small web app that produces a 10-year (2027–2036) revenue forecast for a new drug using a
patient-funnel model. Forecasters edit year-by-year assumptions for Base, Upside, Downside and custom
scenarios, compare results, export them, and save read-only versions. Brand Leads review the
forecasts and comment on saved versions.

Built as a take-home engineering case study: a patient-funnel revenue forecast for a new drug launch.
All data is synthetic.

---

## Quick start

Requirements: **Docker** with Docker Compose v2.

```bash
docker compose up
```

Open **http://localhost:8080**. The first start builds the images, which takes a few minutes. The
database is migrated and seeded automatically.

| Role       | Email                    | Password         | Can do |
|------------|--------------------------|------------------|--------|
| Forecaster | `forecaster@example.com` | `Forecaster123!` | Edit inputs, import CSV, create, clone and delete scenarios, save versions, comment |
| Brand Lead | `brandlead@example.com`  | `BrandLead123!`  | View everything, export CSV, comment on saved versions |

API documentation (OpenAPI/Swagger): http://localhost:8080/docs

```bash
docker compose down        # stop (data is kept in the `pgdata` volume)
docker compose down -v     # stop and delete all data; the next start re-seeds the demo
docker compose up --build  # rebuild images after changing code
```

### Configuration

Nothing needs configuring for a local demo. To override anything, copy `.env.example` to `.env`
next to `docker-compose.yml`:

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | a **development-only** value set in `docker-compose.yml` | Signs login tokens. **Set your own (32+ characters) for any shared deployment.** |
| `LAUNCHLENS_WEB_PORT` | `8080` | Host port for the web app |
| `LAUNCHLENS_DB_PORT` | `55432` | Host port for PostgreSQL, bound to `127.0.0.1` only. It's an uncommon port, so it won't clash with a local Postgres. |

---

## What's included

| Requirement | Where |
|---|---|
| Year-by-year grid for every funnel input, with validation (0–100 %, no blanks, no negatives) | **Scenarios** page |
| Bulk import from CSV, with the whole file validated before anything is applied | Scenarios → *Import CSV* |
| Forecast engine: patients, gross and net revenue per year and scenario, unit-tested (including the worked check) | `backend/app/forecast/` |
| Create, clone, rename and delete scenarios; Base, Upside and Downside | Scenarios page |
| Compare scenarios | Dashboard: net revenue line chart (with table view) and KPI deltas against Base |
| Save a version with who, when and a comment; past versions are read-only | Dashboard → *Save as version*, or **Version History** → *Current forecast* → *Save as version* |
| Patient funnel for any chosen year | Dashboard and saved versions |
| CSV export: inputs (per scenario) and full results (all scenarios) | Scenarios → *Export CSV*; Dashboard and Versions → *Export results CSV* |
| Two roles with access control enforced in the API | `backend/app/api/deps.py`, plus tests in `backend/tests/api/test_permissions.py` |
| Starts with `docker compose up` | `docker-compose.yml` |

### Forecast logic

For each year and scenario:

```
patients on drug = prevalent × diagnosed × drug-treated × eligible × peak brand share × uptake
gross revenue    = patients on drug × compliance × annual price
net revenue      = gross revenue × (1 − gross-to-net)
```

Worked check (year 5, population growth off): 2,000,000 × 60% × 50% × 40% × 20% × 100% = **48,000**
patients. × 80% × USD 10,000 = **USD 384M** gross, × 75% = **USD 288M** net. The engine reproduces
this exactly (`backend/tests/test_engine.py::test_worked_example_single_year`).

---

## Architecture

```
Browser ──► nginx (frontend container, :8080)
              ├── /          → React single-page app (static build)
              ├── /api/*     → FastAPI (backend container, :8000, internal network only)
              └── /docs      → FastAPI OpenAPI UI
FastAPI ──► PostgreSQL 16 (db container, named volume `pgdata`)
```

- **Forecast engine** (`backend/app/forecast/`): pure Python functions with Pydantic models and
  `Decimal` arithmetic. It doesn't depend on the database, the API or the UI, and contains no
  business constants or scenario-specific logic.
- **Backend** (`backend/`): FastAPI, SQLAlchemy 2, Alembic and Pydantic. JWT login (Argon2
  password hashes) and role checks are FastAPI dependencies. Services handle persistence and call
  the engine. On startup the container waits for the database, runs `alembic upgrade head` and
  seeds idempotently.
- **Frontend** (`frontend/`): React 19, TypeScript, Vite, React Router and Recharts. A central API
  client attaches the token and handles 401/403/422 responses. Pages are organised by feature
  (scenarios, dashboard, versions).
- **Data model:** `users`, `scenarios` and `scenario_year_inputs` (one row per scenario and year,
  with a unique constraint and range CHECK constraints), `forecast_versions` (JSONB snapshot) and
  `comments`.

More detail: [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

---

## Assumptions

Where the brief left something open, I assumed the following:

1. **Percentages** are entered and stored on a 0–100 scale. Patient counts and prices must be zero
   or more.
2. **Launch timing and horizon:** 2027 is launch year 1 and the horizon is fixed at ten calendar
   years (2027–2036), as the brief specifies. The grid shows both clocks ("2027 / Y1"): calendar
   years drive population, price and gross-to-net, and years since launch drive uptake. A later
   launch can be modelled today by setting the early years' uptake to 0% and shifting the curve.
3. **Population growth:** 1% a year is used only to *pre-fill* each year's prevalent population. After
   that every year's population is independently editable, so changing one year doesn't cascade.
4. **Uptake:** "Y5+ 100%" means the Y5 value continues to 2036. The illustrative Downside uses the
   same rule, so 85% continues from Y5.
5. **Compliance** multiplies compliant patient-years: patients pay for that fraction of a full year.
6. **Seeded scenarios: these values are synthetic and illustrative, chosen for this demo, and were
   not supplied by the assignment.** All other inputs match Base. Each is just an editable starting
   point.

   | Scenario | Peak share | Uptake Y1–Y5 (then held) | Gross-to-net |
   |---|---|---|---|
   | Base (from the brief) | 20% | 10 / 30 / 55 / 80 / 100% | 25% |
   | Upside (illustrative) | 25% | 15 / 40 / 65 / 85 / 100% | 25% |
   | Downside (illustrative) | 15% | 5 / 20 / 40 / 65 / 85% | 30% |

7. **Scenario types:** the API has no scenario-type field, so Base, Upside and Downside are
   recognised by name. A renamed standard scenario is shown as "Custom". Users can create any number
   of additional scenarios.
8. **Versions** snapshot the *whole workspace*: every scenario's name, description, ten years of
   inputs and calculated results, as currently saved. Unsaved grid edits aren't included. Snapshots
   are self-contained, so editing or deleting a scenario never changes history. The database itself
   rejects updates and deletes on saved versions (a trigger). In the UI, saving sits with the live
   forecast (on the Dashboard, and on a "Current forecast" entry at the top of the version list),
   never next to a past version, and the save dialog previews every scenario that will be included.
9. **Comments** belong to saved versions. Both roles can comment; the brief requires it for Brand
   Leads.
10. **A version comment** is required in the UI (the brief says a version stores a comment). The API
    accepts an empty one.
11. **Export:** I chose CSV, since the brief allows "Excel or CSV". Files open in Excel (UTF-8 with a
    BOM).
12. **CSV import format** is identical to input export: one row per year, with columns `year,
    prevalent_patients, diagnosed_pct, drug_treated_pct, eligible_pct, peak_brand_share_pct,
    uptake_pct, compliance_pct, annual_price, gross_to_net_pct`.
    - Column and row order are free.
    - Thousands separators, `$` and `%` are tolerated.
    - Any error rejects the whole file.
    - Imported values become *unsaved edits*, so they're reviewed before the user clicks Save.
    - Values are compared as numbers, not text: Excel re-saving `2020000.00` as `2020000` isn't
      counted as a change, and the saved value is kept.
13. **Precision:** calculations use `Decimal` and are never rounded internally. The API sends numbers
    as decimal strings. Rounding happens only for display, and exports keep full precision.

## Trade-offs and known limitations

- **Token storage:** the JWT is kept in `localStorage`, which is simple but readable by an XSS. An
  HttpOnly cookie with CSRF protection would be stronger. Tokens expire after 60 minutes and there
  are no refresh tokens.
- **Fixed forecast horizon:** the engine is year-agnostic (`calculate_year` never looks at the
  year), but the 2027–2036 range is enforced in validation, a database CHECK constraint, the seed
  data and the UI. The next step would be a launch year per scenario, with uptake entered as a
  Y1–Y10 curve and placed onto calendar years from that launch year, so "launch slips to 2028" is
  one field rather than ten edits, while scenarios still compare on one calendar chart. Making the
  window itself configurable would mean moving the bounds into settings and replacing the CHECK
  constraint with a migration.
- **Concurrent edits:** last write wins. There's no optimistic locking or edit history per scenario
  beyond saved versions.
- **Snapshot storage:** each version stores the full workspace in JSONB. That's simple and fully
  self-contained, at the cost of some duplicated storage.
- **CSV handling** happens in the browser. There's no server-side import endpoint; the import becomes
  a normal validated save, so the API's permission and validation rules still apply.
- **Demo configuration:** the demo accounts and the Compose development JWT secret are meant for
  demos. The hosted deployment uses a generated secret. There's no login rate limiting, user
  management or pagination.
- **Container images:** the image scanner reports high-severity CVEs in the upstream
  `python:3.12-slim` base image. A production build would pin a patched digest or a hardened base
  image.
- **Browser tests:** besides the automated suites below, I verified the end-to-end flows in a real
  browser (Microsoft Edge via Playwright) against the Docker stack and the hosting image. That script
  isn't part of the repository's test suite.
- **Hosted demo:** the demo credentials are public, so anyone can change or delete its data. If every
  scenario is deleted, restarting the service re-seeds Base, Upside and Downside. Free-tier limits
  apply (see *Hosting*).

---

## Hosting (Render)

The app is deployed to Render's free tier from [`render.yaml`](render.yaml), which defines:

- **one Docker web service** built from the root [`Dockerfile`](Dockerfile). FastAPI serves both
  the API and the React build (`STATIC_DIR`), so there's a single public URL and a single cold start;
- **a free PostgreSQL database.** Its connection string is passed in as `DATABASE_URL` (normalised
  to the psycopg driver), and `JWT_SECRET` is generated by Render.

Steps: Render → **New → Blueprint** → select this repository → **Apply**. Every push to `main`
redeploys. On start, the container migrates and seeds exactly as it does in Docker Compose. The
health check path is `/api/health`.

Free-tier caveats (at the time of writing): the service sleeps after about 15 minutes idle, so the
next visit takes roughly a minute to wake it. Free databases expire 30 days after creation unless
upgraded.

The root `Dockerfile` works on any container host. It honours `$PORT` and needs `DATABASE_URL`
and `JWT_SECRET`. `docker-compose.yml` is still the way to run the project locally.

---

## Running the tests

**Frontend** (Vitest and Testing Library, no backend needed):

```bash
cd frontend
npm ci
npm test            # unit and component tests
npm run build       # type check and production build
```

**Backend.** Engine unit tests need nothing else. API and integration tests run against real
PostgreSQL:

```bash
docker compose up -d db                # PostgreSQL on 127.0.0.1:55432, including the launchlens_test database
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt     # Windows: .venv\Scripts\pip ...
cp .env.example .env                              # then set JWT_SECRET (any 32+ characters)
.venv/bin/python -m pytest                        # Windows: .venv\Scripts\python -m pytest
```

If PostgreSQL isn't reachable, the API tests are skipped and the reason is printed. The suite drops
and recreates the schema in `launchlens_test` only.

---

## AI assistance disclosure

This project was built with substantial help from **Claude Code**.
Claude Code was used for:

- **Implementation and code generation:** much of the backend, frontend, Docker setup and
  documentation was generated by Claude Code from my phase-by-phase requirements.
- **Testing:** writing unit, API, integration and component tests, running them, and running browser
  checks against the running app.
- **Debugging:** diagnosing and fixing failures found by the tests, the type checker and visual
  review.

I set the requirements and made the design decisions: the patient-funnel structure, roles and
permissions, the versioning model, the illustrative scenario values, the CSV format and the
deployment approach. I also reviewed the generated code and validated the behaviour, including the
worked example, the test results and the running application. **Not all code in this repository was
written independently by me.**

### In Claude Code's own words

> Atharva asked me to add this note myself.
>
> **What I did.** I wrote most of the code in this repository: the forecast engine, the API, the
> database models and migrations, the React app, the Docker and Render setup, and nearly all of the
> tests. I also drafted most of this README and the script for the demo video. I ran the checks
> described above, including browser runs against the Docker stack and the live demo.
>
> **What Atharva did.** Atharva set the requirements phase by phase, made the product and design
> decisions, and reviewed the app by using it. Several fixes came from that review, not from my
> tests:
> - I had compared imported CSV values as text, so a file re-saved in Excel highlighted cells that
>   hadn't changed.
> - The input grid's group headers scrolled out of view when scrolling sideways.
> - The Version History page didn't make clear what saving a version captures.
>
> Atharva also asked for the launch-year labels (Y1–Y10), for saving to be disabled when there are no
> scenarios, and for tests that went beyond the brief to be removed.
>
> **Worth knowing.** My tests check the code against the requirements as I understood them, so any
> misunderstanding of mine could be in both the code and its tests. The scenario values are
> illustrative, not market data.
