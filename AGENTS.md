# AGENTS.md

Call Calendar: a slot-booking service. Three packages in one repo:
- **root**: TypeSpec API spec (`main.tsp`) + dev tooling (Prism mock). Its `package.json` deps are only TypeSpec + Prism.
- **`backend/`**: FastAPI (Python 3.13, venv at `backend/.venv`). No DB — persistence is a YAML file.
- **`frontend/`**: React 19 + Vite, Mantine v9, React Router v7, TanStack Query v5, MSW for tests.

## The API contract is the source of truth

`main.tsp` is the single source of truth for the API. `npm run compile` emits `tsp-output/@typespec/openapi3/openapi.yaml` (gitignored). Frontend types in `frontend/src/api/schema.d.ts` are generated from it via openapi-typescript.

The vitest contract test (`frontend/src/test/contract.spec.ts`) reads the generated openapi.yaml and requires an MSW handler for **every** spec operation (`frontend/src/test/mocks/handlers.ts`). When you change `main.tsp`:
1. `npm run compile` (root)
2. `npm run api:types` (regenerate frontend types)
3. Add/update the matching MSW handler, or the contract test fails.

`npm run compile:types` (root) does steps 1+2.

## Commands

- Compile spec: `npm run compile` (root)
- Backend tests: `backend/.venv/bin/python -m pytest backend/tests -q` (or `cd backend && .venv/bin/python -m pytest tests -q`)
- Frontend: `cd frontend && npm run typecheck && npm run lint && npm test` (typecheck=`tsc -b`, lint=oxlint, test=vitest in jsdom + MSW)
- E2E: `cd frontend && npx playwright install chromium && npm run test:e2e`
- Prism mock from spec: `npm run mock` (port 4010)

### Run the stack via the Makefile

Two variants, both driven by `make`:

- **Docker (default):** `make build` (image), `make start` (docker compose up -d), `make stop` (docker compose down), `make restart` (docker compose restart). The container listens on the port from the `PORT` env var (default 8000), e.g. `PORT=8080 make start`. Data lives in the compose volume `data`; logs via `docker compose logs -f`.
- **Local dev servers:** `make local_start` / `make local_stop` / `make local_restart` — backend via `python -m app.main` (port from `PORT`, default 8000) + vite dev (:5173), logs in `.run/*.log`.

For the local targets, do not start uvicorn/vite dev servers manually — they won't be tracked by `make local_stop`, and the Makefile assumes the venv (`backend/.venv/bin/python`) and root npm install are present.

Use the venv python for backend, not a global one. Root and `frontend/` each have separate `npm install`.

## Testing quirks

- `npm test` in `frontend/` FAILS on a fresh clone until `npm run compile` is run, because the contract test reads the gitignored `tsp-output/`.
- E2E (Playwright) starts a real backend + frontend itself via `webServer` in `playwright.config.ts`: uvicorn on :8000 with `DATA_FILE` pointing at a fresh temp YAML (`E2E_STORE_FILE`, reset per run), and `vite build && vite preview` on :4173. Requires `npx playwright install chromium`.
- Backend tests build the app via `create_app(store=Store(), now_provider=lambda: FIXED_NOW)` (backend/tests/test_api.py): pass an in-memory `Store()` and a fixed `now_provider`; never touch the real data file.

## Backend gotchas

- Persistence is a YAML file (default `backend/data/store.yaml`, gitignored) via `Store` (app/store.py). Override with `DATA_FILE` env var. Writes are locked and atomic.
- Error conventions: malformed request body / wrong types → 400 `{"error":"Invalid request"}`; business validation → 422 `{"errors":[{field,message}]}`; conflicts/duplicates → 409 `{"error":...}`; not found / out of booking window → 404.
- Domain rules are constants in `backend/app/services.py`: working hours 08:00–20:00, 30-min grid, booking window = today..today+13, server-local time (no guest timezone).
- No auth; roles are implicit by URL prefix (`/guest/*`, `/admin/*`, `/event-types`). CORS is wide open.

## Conventions

- UI strings, docs, test descriptions, and commit messages are in **Russian**.
- Commits MUST follow Conventional Commits (types: `feat|fix|docs|chore|refactor|test|ci|style|perf|build|revert`, lowercase type/scope, header ≤100 chars, no trailing period). Enforced by commitlint and consumed by release-please — a broken format blocks automatic releases.
- Do not edit or delete `.github/workflows/hexlet-check.yml` (Hexlet grading).
- Playwright MCP is configured in `.opencode/opencode.json` for browser testing; requires `npx playwright install chromium`.