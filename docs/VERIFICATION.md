# Verification record

The assembled project was checked in the provided workspace on 2026-09-23.

| Check | Result |
|---|---|
| Backend pytest suite | 60 tests passed, including Person 3 provider tests and Person 4 backup tests |
| Frontend model tests | 8 tests passed |
| TypeScript + Vite production build | Passed in API mode |
| Synthetic data and assumption ledger validation | Passed for all three evaluation cases |
| Real browser against FastAPI/SQLite, rule-based advisor | Passed: API contracts, overrun rejection, save/reload/refine/compare |
| Real browser against FastAPI/SQLite, Person 3 adapter | Passed with mocked provider HTTP responses; UI displayed the AI report |
| Local development launcher | Passed on Linux: proxied API available, both servers stopped on Ctrl+C |
| Deployment smoke script against a local API | Passed: config, persistence, budget rejection, changed score and rule-based analysis |
| Online SQLite backup | Tested with committed WAL data and overwrite rejection |
| Docker images, Compose startup and Nginx routing | Not executed: Docker and Nginx unavailable in this environment |
| GitHub Actions workflow | Supplied, not executed on GitHub |
| Live AI provider | Not called; requires the team's key and model access |
| Container backup restore | Not executed |

The browser runs exercised real frontend code and real HTTP API/database operations. Only the AI provider's external HTTP response was mocked in the AI-mode run. A mocked AI response proves integration and rendering, not the model's explanation quality.

Existing frontend dependencies were reused in this workspace. A clean `npm ci` and container build should be run on the team's machine. The Python tests emitted a non-fatal Starlette/httpx deprecation warning. The frontend build emitted non-fatal upstream comment-annotation warnings; compilation succeeded.

## Reproduction

Install dependencies as described in the root README, then run:

```bash
python scripts/verify.py --browser
docker compose up --build --wait
python scripts/smoke.py --write --analysis
```

For a real AI demonstration, set the TeamAdvisor and API key first. The final command can create provider charges. Manually review the output against the chosen decisions and saved numeric score before presenting it to judges.
