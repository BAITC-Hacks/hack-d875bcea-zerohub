# Akim for 5 Hours — Person 4 integration and release

This is the complete assembled team project: Person 1's React interface, Person 2's FastAPI/SQLite simulator, Person 3's AI advisor and data tools, plus Person 4's deployment, verification and demo tooling. You do not need to merge the three earlier ZIP files again. Use this folder as the project root.

A participant receives 100 virtual budget units, makes one decision in each of five areas, and sees the resulting Astana Quality of Life Score. The backend calculates all costs and scores. The optional live AI explains the calculated results and tested alternatives.

All data and effects are synthetic. The score is an educational model, not an official Astana index or real-world forecast.

## Person 3's code

| File | Purpose |
|---|---|
| `compose.yaml` | Start frontend and backend together, retain SQLite data, check health |
| `frontend/nginx.conf` | Serve the built UI and forward `/api/` to FastAPI |
| `.dockerignore`, `frontend/.dockerignore` | Exclude local secrets and generated files from build contexts |
| `.env.example` | Configure the assembled deployment |
| `scripts/dev.py` | Start the local API and frontend together |
| `scripts/verify.py` | Run backend, data, frontend and optional browser checks |
| `scripts/check-stack.mjs` | Exercise real React → HTTP → FastAPI → SQLite integration |
| `scripts/smoke.py` | Check a running deployment; optional scenario and analysis checks |
| `backend/scripts/person4_backup.py` | Consistent SQLite backup with integrity validation |
| `backend/tests/person4/` | Backup tests and test-only mocked provider application |
| `scripts/package_release.py` | Build a source ZIP with SHA-256 checksums |
| `.github/workflows/ci.yml` | Application checks, browser integration and container smoke check |
| `docs/` | Deployment runbook, demo script, rubric mapping and verification record |

The application code from Persons 1–3 is included. Their original guides are preserved in `docs/team/`; paths in those guides refer to the earlier packages. This README governs the assembled project's launch procedure. The frontend's old standalone Dockerfile has its original default; Compose explicitly builds it in API mode.

## Quick start with Docker

Requires Docker Engine/Desktop with Docker Compose v2. From this folder:

```bash
cp .env.example .env
docker compose up --build --wait
```

On PowerShell, use `Copy-Item .env.example .env` for the first command. Open **http://127.0.0.1:8080**.

The initial mode uses clearly labeled rule-based explanations and needs no API key. It verifies the simulator but does not meet the live AI requirement by itself. To enable Person 3's actual AI, edit the root `.env`:

```dotenv
AKIM_ADVISOR_FACTORY=app.services.team_advisor:TeamAdvisor
AKIM_ANALYSIS_VERSION=person4-ai-v1
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini-2025-04-14
```

Then apply the configuration change:

```bash
docker compose up -d --force-recreate backend frontend
python scripts/smoke.py --write --analysis
```

The second command creates two scenarios and requests one analysis; AI mode may incur provider charges. Python 3.12 is sufficient for this smoke script; no Python packages are needed. Keep API credentials out of the frontend. Never commit `.env`. After any model or prompt change, increment `AKIM_ANALYSIS_VERSION` to avoid reusing an older cached assessment.

## Local development without Docker

Requires Python 3.12 and Node.js 24 (or a compatible version meeting the frontend's engine requirement).

```bash
python -m venv .venv
```

Activate it with `source .venv/bin/activate` on macOS/Linux, or `.venv\Scripts\Activate.ps1` in PowerShell. Then:

```bash
python -m pip install -r backend/requirements.lock
npm --prefix frontend ci
python scripts/dev.py
```

Open **http://127.0.0.1:5173**. The local launcher selects frontend API mode; FastAPI listens on port 8000. Press Ctrl+C to stop the services. Local AI settings go in **`backend/.env`**, following `backend/person3.env.example`. Docker instead reads the **root `.env`**. These are distinct configuration paths.

## Verify the project

With the Python environment activated and frontend dependencies installed:

```bash
python scripts/verify.py
```

To include real browser integration:

```bash
cd frontend
npx playwright install chromium
cd ..
python scripts/verify.py --browser
```

The browser check owns ports 8001 and 5182. Close any other services using them. It covers scenario creation, budget rejection, results reload, changed decisions, comparison and frontend schema compatibility. It runs both the rule-based backend and Person 3's real adapter with mocked provider HTTP responses. It never needs a provider key or makes a live AI call.

To check an already running deployment without creating data:

```bash
python scripts/smoke.py
```

Add `--write` for scenario persistence and budget checks; add `--analysis` for an assessment. Use `--url http://127.0.0.1:8000` to check a development API directly. The scenario checks target the included v1 dataset.

## Release and demonstration

```bash
python scripts/package_release.py
```

The source archive is written to `artifacts/akim-team-release.zip` and includes `SHA256SUMS`. Generated dependencies, databases, backup files and local environment files are excluded. The archive contains source code and lockfiles; dependencies and base images still require download during a clean setup. Base image tags are not digest-pinned.

Read `docs/DEMO.md` for the demonstration and `docs/DEPLOYMENT.md` for persistence and backup commands. `docs/RUBRIC.md` maps the implemented features to the hackathon criteria. `docs/VERIFICATION.md` states what was tested and what remains unverified.

The default Docker port binds only to localhost. Public hosting is a separate deployment step: configure HTTPS and an access boundary before exposing a shared paid-AI service. This prototype has no accounts or per-user authorization. The supplied configuration is suitable for a local hackathon demonstration, not an unrestricted public service.
