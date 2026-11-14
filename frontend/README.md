# PharmSight Frontend

A React + TypeScript (Vite) interface for the PharmSight forecast API. It includes login, the
application shell, scenario management, a spreadsheet-style input editor and the results dashboard.

## Running locally

You need Node 20+ and the backend running on `http://localhost:8000` (see `../backend/README.md`).

```bash
npm install
npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api` to the backend, so the browser only talks to one origin and the
backend needs no CORS configuration. To point the proxy at a different API, set
`PHARMSIGHT_API_URL`, for example `PHARMSIGHT_API_URL=http://localhost:9000 npm run dev`.

Demo accounts (created by `python -m app.seed`):

| Role       | Email                    | Password         |
|------------|--------------------------|------------------|
| Forecaster | `forecaster@example.com` | `Forecaster123!` |
| Brand Lead | `brandlead@example.com`  | `BrandLead123!`  |

## Scripts

| Command             | What it does                                     |
|---------------------|--------------------------------------------------|
| `npm run dev`       | Dev server with hot reload and the API proxy     |
| `npm test`          | Unit and component tests (Vitest + Testing Library) |
| `npm run typecheck` | TypeScript check                                 |
| `npm run build`     | Type check and production build into `dist/`     |

## Structure

```
src/
  api/          Central API client (fetch + bearer token, ApiError, 401 hook) and typed endpoints.
                types.ts mirrors the backend's OpenAPI schemas.
  auth/         AuthContext (login, logout, session restore) and RequireAuth route guard
  workspace/    WorkspaceContext: scenario list and active scenario, shared by Dashboard and Scenarios
  components/   App shell and shared UI (Modal, ConfirmDialog, ErrorBanner, LoadingState, badges)
  features/
    login/      Sign-in page
    scenarios/  Scenario list, editor, input grid, create/rename/clone dialogs, client-side validation
    dashboard/  KPI cards, net revenue chart (with table view), patient funnel
    versions/   Placeholder: version history arrives in a later phase
  lib/          Number formatting, scenario type and colour helpers
```

## Behaviour notes

- **Authentication.** The JWT is kept in `localStorage` and sent as a bearer token by the central
  client. Any 401 on an authenticated request signs the user out and shows "session expired". After
  signing in again, the user returns to the page they asked for.
- **Roles.** Forecasters can create, rename, clone, delete and edit scenarios. Brand Leads get a
  read-only view, with no inputs and no mutation buttons. This is a convenience only: the backend
  enforces permissions, and any 403 it returns is shown to the user.
- **Precision.** The API sends every number as a decimal string. The grid displays a formatted value
  (`2,187,371`) and shows the exact value (`2187370.545368721802000000`) while a cell is being edited
  and on hover. Untouched cells are sent back exactly as received. Edited cells are only stripped of
  formatting characters (`,` `$` `%` and spaces), never rounded.
- **Validation.** Values are checked as you type (must be a number, not negative, percentages 0–100),
  and Save stays disabled until every value is valid. Server 422 errors are mapped back onto the
  affected cells.
- **Unsaved changes.** Edited cells are highlighted. Switching scenario, navigating away or closing
  the tab asks for confirmation first. Renaming a scenario saves only its name and description, never
  unsaved grid edits.
- **Scenario types.** The API has no scenario-type field, so Base, Upside and Downside are recognised
  by name. A renamed standard scenario is shown as Custom.
- **Charts.** Each scenario keeps a fixed colour (Base blue, Downside orange, Upside aqua, then the
  next palette slots for custom scenarios). The palette was checked for colour-vision deficiency. The
  net revenue chart has a legend, a hover tooltip and a table view.
