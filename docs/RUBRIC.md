# Hackathon criteria and evidence

| Criterion | Implementation and evidence | Remaining demonstration |
|---|---|---|
| Functionality — 25 | Shared v1 dataset and 100-unit budget; five categories; server-side budget enforcement; saved scenarios; score changes; results explanation | Run a complete user journey with live AI enabled |
| Technical implementation — 25 | React/TypeScript, validated API schemas, FastAPI/SQLite, deterministic scoring, asynchronous provider adapter, structured AI output, bounded retries, persistent cache | Execute container CI and check the real provider using the team's key |
| README and reproducibility — 25 | Assembled source, Python/npm lockfiles, Compose, setup instructions, automated checks, source packaging and checksums | Reproduce on a clean team machine and record its commit/version |
| Value and applicability — 15 | Makes limited-resource trade-offs visible, including average quality and worst-district quality; compares saved plans and suggests tested replacements | Explain the educational use case and synthetic-data limits |
| Development potential/originality — 10 | Separates deterministic scoring from AI explanation; explicit numeric evidence references; considers district inequality | Discuss calibration, public consultation, events, authenticated team rankings and richer models as future work |

## Required verification cases

- Same starting data: `/api/config` is stable across requests; costs and scores cannot be supplied by the browser.
- Budget control: exactly affordable plan accepted; an over-budget plan rejected with HTTP 422.
- Five decisions: one per category, validated by the backend; missing/duplicate categories rejected.
- Decisions affect indicators and score: checked by model tests, reference fixtures and browser refinement.
- Clear explanation: structured strengths, risks, trade-offs and tested alternatives; AI prose still requires human review.

The included comparison feature compares scenarios available to the current browser. It is not a shared cross-team leaderboard. The project does not implement random events or automatic slide export; these are optional future features, not completed claims.
