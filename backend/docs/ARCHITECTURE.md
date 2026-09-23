# Person 2 implementation map

| File | Owns |
| --- | --- |
| `app/main.py` | App factory, lifespan startup, CORS and public errors |
| `app/config.py` | Environment configuration and stable paths |
| `app/schemas.py` | Strict request models and frontend-compatible responses |
| `app/database.py` | SQLite schema, per-operation connections and transactions |
| `app/models.py` | Stored result/configuration bundle |
| `app/routes/` | Thin HTTP endpoint handlers |
| `app/services/dataset.py` | Load and validate the configured synthetic dataset |
| `app/services/validation.py` | Category, eligibility, ID, version and budget rules |
| `app/services/simulation.py` | Fresh baseline, stable effect accumulation and clipping |
| `app/services/scoring.py` | District and city Quality of Life Scores |
| `app/services/scenarios.py` | Validate, create identity/timestamp and persist |
| `app/repositories/scenarios.py` | Version fingerprints, snapshots, idempotency, analysis leases/cache |
| `app/services/recommendations.py` | Evaluate affordable single-decision alternatives |
| `app/services/ai_advisor.py` | Async provider protocol and working rule-based implementation |
| `app/services/analysis.py` | Timeouts, provider isolation, candidate assembly and caching |
| `scripts/check-frontend.mjs` | Real FastAPI + SQLite + React browser integration check |

## Submission sequence

1. Pydantic rejects malformed bodies and undeclared fields.
2. An optional idempotency key can return a previously saved result for the same request.
3. Validate exactly five decisions against the current dataset, including total cost.
4. Calculate baseline/final snapshots with the deterministic engine.
5. Generate a UUID and UTC timestamp.
6. Inside one SQLite transaction, recheck the idempotency key, insert the scenario snapshot and configuration, and insert all five normalized decisions.
7. Return the committed snapshot. A failed insert rolls back both tables.

Previews perform steps 1, 3 and 4 with partial decisions permitted; they do not persist scenarios. Each preview recomputes from the original baseline, so stale requests cannot accumulate effects in server state.

## Analysis sequence

Load the saved result and its original configuration. Claim a short-lived database lease, or return an existing completed report. Evaluate single-decision candidates using that saved configuration. Call the configured async advisor with copies of the facts and candidates. Validate its narrative, attach only known candidate explanations, save the completed report, and return it. Failed attempts release their claim and preserve the result snapshot.

The provider runs outside a database transaction. SQLite locks are held only for brief claim/save operations. Database work in the async analysis route is dispatched to worker threads.

## Data versioning

The combination of dataset and engine version has a stored configuration fingerprint. Startup fails if that combination is reused with different contents. Every saved scenario also has its own config/result snapshots. Current configuration changes therefore cannot rewrite a past result.

`ENGINE_VERSION` must change with algorithm changes. This build only calculates engine `1.0`. Reading saved results does not rerun the engine. If future code drops support for an archived engine, a new analysis for it should fail clearly, while cached reports/results remain readable.

## Deployment boundaries

Use a local persistent disk for the SQLite database and share the same versioned data across application instances. Authentication and user-level authorization are not part of this MVP. A real multi-team ranking system would need additional endpoints and policy decisions; Person 1's current comparison page is local to the browser.

The backend includes one explicit provider extension point. It does not include a model-specific SDK, API key or fabricated live AI response.
