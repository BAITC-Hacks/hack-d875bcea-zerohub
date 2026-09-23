# Akim for 5 Hours — Person 2 backend

A working FastAPI + SQLite backend that matches the API used by the previously delivered Person 1 React frontend. This package contains the authoritative budget, validation, simulation, scoring and persistence code. It also provides an analysis endpoint with a working rule-based advisor and a documented extension point for Person 3's live AI.

## Quick start

Install Python **3.12 or newer**. Extract the archive, open a terminal in `akim-person-2/backend`, and create a virtual environment:

```bash
python -m venv .venv
```

Activate it:

```bash
# macOS / Linux
source .venv/bin/activate
```

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Then install the tested dependency versions and start the server:

```bash
python -m pip install -r requirements.lock
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open:

- **http://127.0.0.1:8000/docs** — interactive API documentation.
- **http://127.0.0.1:8000/api/health** — health and analysis mode.
- **http://127.0.0.1:8000/api/config** — shared starting data.

No API key, external database or `.env` file is required for the default setup. The SQLite database is created automatically at `backend/var/akim.sqlite3` on first startup. The dependency lock includes runtime and test tools and was verified with Python 3.12.

## Connect Person 1's frontend

Keep the backend running. In Person 1's `frontend/.env`, set:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
```

Start or restart the frontend in a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The existing Vite proxy sends `/api` to `http://127.0.0.1:8000`. The frontend needs no source-code changes. Its badge should say **Connected · synthetic data**. Create a scenario, submit it, refresh the results page, and refine a decision to see the score change.

The assessment is explicitly labeled **rule-based** until Person 3 connects a real AI provider. This backend alone does not claim to satisfy the hackathon's live AI requirement.

## Merge into the team repository

Copy the `backend/` directory and `data/v1/` into the agreed repository structure:

```text
akim-for-5-hours/
  frontend/          Person 1's existing code
  backend/           This package
  data/v1/           This package's matching synthetic dataset
```

Keep existing teammate files when merging. The default data path is resolved relative to the backend directory, so the server works in this layout. The root `compose.yaml` is a backend-only starter; Person 4 can merge it into the team's deployment configuration.

## What Person 2's code handles

- One fixed starting budget and the same versioned dataset for all sessions.
- Partial previews with zero to five decisions.
- Final submissions with exactly one decision per category.
- Unknown IDs, duplicate categories, district eligibility, dataset-version conflicts and budget-overrun rejection.
- Rejection of client-supplied prices, budgets, scores and other undeclared request fields.
- Deterministic simulation from an immutable baseline, with aggregate effects clipped to 0–100.
- Population-weighted scoring and the lowest-district component.
- Atomic saving of a scenario and all five decisions.
- Original result and configuration snapshots that survive restarts and dataset updates.
- Optional idempotent creation using `Idempotency-Key`.
- Cached analysis with a database lease to deduplicate simultaneous analysis requests.
- Affordable, verified single-decision recommendations.
- Rule-based analysis plus an async advisor interface for Person 3.
- Explicit analysis failure responses while the saved scenario remains available.
- CORS, health endpoint, OpenAPI documentation, a dependency lock, tests and a Docker example.

## Endpoints

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/config` | Return budget, model, districts and initiatives |
| POST | `/api/preview` | Validate and calculate 0–5 decisions without saving |
| POST | `/api/scenarios` | Validate and save a complete five-decision scenario |
| GET | `/api/scenarios/{id}` | Return the saved immutable result |
| POST | `/api/scenarios/{id}/analysis` | Return a completed cached or newly generated report |
| GET | `/api/health` | Check database availability and show active versions/source |

Requests and response shapes are documented in `backend/docs/API-CONTRACT.md`. Exact frontend JSON fixtures are in `backend/tests/fixtures/`. The generated OpenAPI schema is in `backend/docs/openapi.json`; regenerate with `python -m scripts.export_openapi`.

Example preview:

```json
{
  "dataset_version": "v1",
  "decisions": [
    {"initiative_id": "transport_bus_priority", "district_id": "district_01"}
  ]
}
```

The frontend sends only IDs and the dataset version. Costs, effects and scores always come from the backend's configured dataset and engine.

## Scoring

Each district starts with five indicators on a 0–100 scale, with higher meaning better. Apply all selected effects to the target districts, then clip the resulting indicators once. Repeated previews always restart from the baseline.

1. **District score:** weighted sum of the five indicators; each has 20% weight in v1.
2. **City average:** sum of district score × population, divided by total population.
3. **Astana Quality of Life Score:** 80% city average + 20% lowest district score.

Baseline: **47.1375**. The backend does not round results for display. This is the team's synthetic learning index, not an official Astana index or a causal forecast. All initiative effects and costs are assumptions.

## Configuration

Copy `backend/.env.example` to `backend/.env` only if you need to change defaults. Environment variables override `.env`. Relative file paths are resolved from `backend/`, independently of your terminal's working directory.

| Variable | Default / meaning |
| --- | --- |
| `AKIM_DATA_DIR` | `../data/v1` |
| `AKIM_DATABASE_PATH` | `var/akim.sqlite3` |
| `AKIM_CORS_ORIGINS` | Localhost/127.0.0.1 on port 5173; comma-separated origins |
| `AKIM_ADVISOR_FACTORY` | `app.services.ai_advisor:RuleBasedAdvisor` |
| `AKIM_ANALYSIS_VERSION` | `1`; increment when changing a prompt, provider model or analysis logic |
| `AKIM_ANALYSIS_TIMEOUT_SECONDS` | `45`; must be greater than zero and no more than 50 |

All application instances in the same competition must load the same dataset version. To revise the data, create a new version; the database fingerprints configurations and rejects changing existing content under the same version. Existing results remain readable with their original snapshots.

## Person 3 handoff

Read **backend/docs/PERSON-3-HANDOFF.md**. Person 3 implements an async advisor that receives the calculated scenario, original configuration and tested alternative plans, and returns a `Narrative`. Select its factory with `AKIM_ADVISOR_FACTORY`.

The backend owns numeric scores, candidate costs and candidate decisions. An advisor can supply narrative text and explanations for known candidate IDs. It cannot inject a different numeric recommendation through this interface. Free-form narrative still needs grounding and quality checks in Person 3's implementation.

The default rule-based report is honest and functional; it is useful while developing and does not call a language model. A failing configured provider returns HTTP 503, never a falsely labeled AI response. Its failed report is not cached, and analysis can be retried.

## Persistence and retries

The database stores scenario snapshots, configuration snapshots, normalized decisions, a dataset registry and cached analysis. SQLite uses WAL mode, foreign keys and short transactions. Connections are created per operation, so request threads do not share a SQLite connection.

For retry-safe scenario creation, optionally send a unique `Idempotency-Key` header (8–128 characters) and reuse it for retries of the same plan. Reordering the same five decisions is treated as the same request. Reusing a key with different decisions returns 409. Concurrent identical requests are saved once. Without the header, each successful submission intentionally creates a new scenario. Person 1's current frontend does not send this optional header.

Analysis reports are cached by scenario, advisor identity/source and analysis version. A database lease prevents duplicate concurrent generation across processes sharing the database. Crashed leases expire. A worker crash after a provider has charged but before the report is saved can still require a later retry; exactly-once external billing is not guaranteed.

## Tests

With the virtual environment active, from `backend/`:

```bash
python -m pytest
```

The tests cover the frontend's golden fixtures, independent baseline arithmetic, valid and invalid budgets, category coverage, tampering, clipping, eligible targets, deterministic recalculation, persistence, transaction rollback, concurrent idempotent creation, version changes, verified recommendations, cached analysis, timeouts and retries.

For the optional real browser integration test, install Person 1's frontend dependencies and Chromium first:

```bash
# In frontend/
npm ci
npx playwright install chromium

# In backend/, with the Python environment still active
node scripts/check-frontend.mjs ../frontend
```

If you keep the two extracted packages separate, pass the actual path to Person 1's `frontend/` instead. This test starts a real FastAPI server on port 8001 and Vite on port 5182, uses an isolated temporary SQLite database, validates responses with the frontend's own Zod schemas, and completes the browser journey without API mocks. It removes its temporary database afterward.

Set `AKIM_TEST_PYTHON` to an explicit Python executable if needed. A preinstalled Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The normal unit/API tests do not require Node or a browser.

## Docker

From the extracted `akim-person-2/` root:

```bash
docker compose up --build
```

The named volume retains SQLite data across container restarts. The container runs as a non-root user. The Docker recipe is supplied for Person 4; it was not executed in this environment.

For manual image building, the build context must be the project root so both `backend/` and `data/` are available:

```bash
docker build -f backend/Dockerfile -t akim-backend .
```

## Scope

This is the hackathon backend. Authentication, shared team rankings, real-world datasets, random events and slide export are separate features. IDs are unguessable UUIDs but are not an authorization mechanism. SQLite is intended for this small deployment on a local persistent disk; Person 4 can plan a database migration if the application grows.

The synthetic model does not simulate implementation time or recurring operating costs. Analysis must meet the frontend's synchronous request timeout; longer-running AI jobs would require an agreed polling contract.

## References

- [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [Python sqlite3](https://docs.python.org/3/library/sqlite3.html)
