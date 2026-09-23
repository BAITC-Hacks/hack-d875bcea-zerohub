# Akim for 5 Hours — Person 1 frontend

Complete React + TypeScript frontend for the four-person hackathon project. Copy the enclosed `frontend/` directory into your team's `akim-for-5-hours/` repository. This package implements Person 1's part; it does not include a Python backend or a live AI provider.

## Run it

Use Node.js 24 (the version used for verification), or a compatible Node release satisfying `package.json`. You also need npm.

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Demo mode is the default, so no environment file or API key is needed to try the complete experience. `npm ci` uses the included lockfile.

If you extracted the archive beside your existing frontend, merge the files intentionally instead of overwriting teammates' work. No files from your team's existing repository were available when this package was created.

## What is implemented

- Welcome page, simulator, final results, and local scenario comparison.
- Responsive layouts for desktop and mobile.
- Six hypothetical districts and 15 synthetic initiatives in demo mode.
- One initiative and target district per category; exactly five decisions to submit.
- Live budget display; disabled unaffordable choices; replacement cost released before checking affordability.
- Warning when the remaining budget cannot fund the unselected categories.
- Debounced previews, cancellation and stale-response protection.
- Final-score display, before/after indicator charts, district comparison table, and scoring explanation.
- AI-report display, loading and retry states, and independently available calculated results when analysis fails.
- Evaluated recommendation cards that can open a modified draft.
- Draft persistence and up to 20 recent results in this browser. Demo and API storage are separate.
- Keyboard-operable tabs, native selects and buttons, visible focus, chart labels, reduced-motion support, and an error boundary.
- Runtime API-response validation with Zod.
- Production build, Docker example, unit tests, and browser tests for both demo and mocked API modes.

## Demo versus API mode

**Demo mode** is a frontend-development fixture. The local adapter calculates a synthetic result and generates an explicitly labeled rule-based explanation. It does not call AI. The demo model helps Person 1 work independently; it is not the production authority for costs or scoring.

**API mode** calls Person 2's backend. The frontend submits only dataset version and initiative/district IDs. The server must validate and calculate all accepted costs, effects and scores. Person 3's live AI must be integrated through that server. The frontend never holds an AI secret or calls an AI provider directly.

There is **no automatic fallback from API mode to demo**. Backend errors remain visible so a broken integration is not mistaken for a working AI simulator.

## Connect to Person 2's backend

Copy `frontend/.env.example` to `frontend/.env` and edit:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
```

Restart `npm run dev`. During development Vite proxies `/api` to `http://127.0.0.1:8000`. Start the team's backend on that address. Adjust the target in `vite.config.ts` if needed.

For a backend on another host, set `VITE_API_BASE_URL` to its full URL ending in `/api`. The backend must allow the frontend origin through CORS when the browser calls a different origin directly.

Read **frontend/docs/API-CONTRACT.md** together before integration. Copy the provided contract fixtures into your team's `contracts/` directory if useful. `src/types/simulation.ts` contains the exact runtime schemas and derived TypeScript types.

**All `VITE_*` values are public build-time configuration. Never put secret keys in them.** Changing the deployment's data mode or API URL requires rebuilding.

## Team handoff

| Owner | Handoff |
| --- | --- |
| Person 1 | Owns the enclosed frontend. Connect API responses, polish UI, maintain frontend tests. |
| Person 2 | Implements config, preview, scenario create/read, and analysis endpoints in the documented shapes. Enforces budget and five decisions on the server. |
| Person 3 | Supplies the authoritative versioned dataset, effects, scoring assumptions, live AI analysis and validated recommendation candidates through the backend. |
| Person 4 | Integrates the services, configures production routing, checks the full real stack, and prepares the final demo and submission. |

## Main files

| Path inside frontend/ | Responsibility |
| --- | --- |
| `src/pages/WelcomePage.tsx` | Introduction and new/resume flow |
| `src/pages/SimulatorPage.tsx` | District and initiative selection |
| `src/pages/ResultsPage.tsx` | Results, analysis, retries and recommendation application |
| `src/pages/ComparePage.tsx` | Two saved plans compared locally |
| `src/components/` | All reusable UI components from the agreed structure |
| `src/hooks/useScenario.ts` | Draft state, preview cancellation, selection and submission |
| `src/hooks/useRoute.ts` | Small hash router; static hosts need no route-specific setup |
| `src/api/client.ts` | Fetch, timeout, HTTP errors and runtime response validation |
| `src/api/scenarios.ts` | Adapter switching between demo and API |
| `src/api/storage.ts` | Optional browser persistence, isolated by mode |
| `src/types/simulation.ts` | Shared TypeScript types and runtime schemas |
| `src/demo/config.json` | Six districts and 15 initiatives; development fixture only |
| `src/demo/engine.ts` | Demo-only calculations and rule-based explanations |
| `src/utils/decisions.ts` | UI affordability and decision-selection helpers |
| `src/styles/global.css` | Complete responsive styling; no external fonts or images |
| `docs/API-CONTRACT.md` | Backend handoff |
| `contracts/` | Executable-shape JSON examples |

## Scoring used by the demo

Every indicator is between 0 and 100; higher is better. Add all applicable effects to the original baseline, then clamp once to the range. Repeated previews never mutate the starting data.

1. District score = equally weighted average of its five indicators.
2. City average = population-weighted average of district scores.
3. Final Quality of Life Score = 80% city average + 20% lowest district score.

The model starts at **47.1375**, displayed as **47.1**. Scoring uses full precision. All users share the same 100-unit budget and dataset version. The index is a project learning model, not an official Astana metric or real-world forecast.

The recommendation fixture evaluates affordable single-decision replacements, including retargeting a district. It reports up to three improvements. It does not claim a globally optimal allocation. Qualitative trade-offs do not change numeric outcomes unless present in an initiative's `effects`.

## Verify it

```bash
cd frontend
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Stop any existing Vite servers on ports **5173 and 5174** before the browser tests. The test configuration starts one demo server and one API-mode server; API responses are mocked by the tests. A real FastAPI/AI service is not needed for these frontend tests.

On Linux, if Playwright reports missing browser system dependencies, follow its installation instructions for your machine. A preinstalled compatible Chromium can also be selected using `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Unit tests verify independent baseline arithmetic, budget boundaries, replacing choices, invalid inputs, deterministic recalculation, clipping, and recommendation validity. Browser tests cover the complete journey, persistence, comparison, mobile overflow, keyboard tabs, no silent fallback, AI failure and out-of-order previews.

## Build and preview

```bash
cd frontend
npm run build
npm run preview
```

Vite writes the static production files into `dist/`. Serve them over HTTP; do not open `index.html` as a `file://` URL. Hash routes look like `/#/simulate` and `/#/results/<id>`.

The Vite development proxy **does not exist in the production build**. Production must use either a real absolute `VITE_API_BASE_URL` or a configured `/api` reverse proxy.

Optional demo container:

```bash
cd frontend
docker build -t akim-frontend .
docker run --rm -p 8080:80 akim-frontend
```

Open http://localhost:8080. To build for a deployed backend:

```bash
docker build --build-arg VITE_DATA_MODE=api --build-arg VITE_API_BASE_URL=https://YOUR-BACKEND-HOST/api -t akim-frontend .
```

Replace the placeholder hostname. The example Nginx config intentionally returns a useful error for `/api` until Person 4 configures a production reverse proxy. The Docker recipe is provided but was not executed in this environment.

## Demo script

1. Start a new scenario and inspect the synthetic districts.
2. Select high-cost initiatives to show that unaffordable options become disabled.
3. Replace an initiative with a cheaper one; observe the freed budget.
4. Complete all five categories and submit.
5. Show the score, district changes, model explanation and rule-based demo assessment.
6. Try a recommendation or refine a decision, submit again and compare the plans.
7. For the final hackathon demonstration, use API mode with the team's real backend and AI analysis; the local fixture alone does not meet the AI requirement.

## Scope and limitations

- All data and effects are synthetic; no real district names, personal data or restricted data.
- “5 Hours” is the project name, not an enforced timer.
- Comparison is local to one browser, not a shared team leaderboard or account system.
- Browser history is best-effort storage, not a database. API-mode results must be saved by the backend. A browser refresh can lose unsaved work if storage is disabled.
- Preview and create requests time out after 20 seconds; AI analysis after 60 seconds. Person 2 should make analysis idempotent/cached and may later add a job/polling endpoint for longer processing.
- The frontend prevents accidental double clicks, but the backend should add idempotency if retrying timed-out create requests must not create duplicates.
- Real events, geospatial maps, authentication, exports, shared rankings and live AI implementation are outside Person 1's scope.

## Documentation references

- [Vite guide](https://vite.dev/guide/)
- [React effects and cleanup](https://react.dev/reference/react/useEffect)
- [Vitest guide](https://vitest.dev/guide/)

The package is source code, not a deployed website.
