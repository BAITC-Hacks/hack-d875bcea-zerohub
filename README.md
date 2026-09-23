# Person 3 — AI advisor and synthetic data

Complete add-on for the previously delivered Person 2 FastAPI backend. Person 1's frontend and Person 2's scoring/API remain the integration contract. Python 3.11+ is required (tested on 3.12).

## Responsibilities and contents

| Path | Responsibility |
|---|---|
| `backend/app/services/team_advisor.py` | Async AI advisor implementing Person 2's plugin interface |
| `backend/app/ai/provider.py` | OpenAI Responses API request and response handling |
| `backend/app/ai/settings.py` | Server-side credentials, model and time limits |
| `backend/app/ai/evidence.py` | Trusted fact catalog from the saved simulation |
| `backend/app/ai/schemas.py` | Strict structured response schema |
| `backend/app/ai/grounding.py` | Validate references and render backend numeric facts |
| `backend/app/prompts/person3_advisor.txt` | Version-controlled advisor instructions |
| `data/v1/` | Identical copy of Person 2's shared synthetic dataset |
| `data/person3/` | Initiative assumption ledger and evaluation scenarios |
| `backend/scripts/person3_*.py` | Data validation, offline evaluation and opt-in live check |
| `backend/tests/person3/` | Provider and backend integration tests |

This is an add-on, not a standalone backend. It does not duplicate the simulation engine, API routes, database or frontend.

## Install into the existing project

Extract this ZIP beside your existing project. From this extracted folder:

```bash
python install_person3.py /path/to/your-project
cd /path/to/your-project/backend
```

The target must contain `backend/app/main.py` and `data/` from Person 2. The installer preflights all files, skips byte-identical files, and refuses to overwrite different files. Keep this README alongside the project for reference.

Activate Person 2's Python environment, then install its locked dependencies if you have not already done so:

```bash
python -m pip install -r requirements.lock
```

`requirements-person3.txt` lists this add-on's direct dependencies, which are already in that lock. No OpenAI SDK is required.

Edit the existing `backend/.env`: set or replace these keys, without removing existing database/CORS settings or creating duplicate entries:

```dotenv
AKIM_ADVISOR_FACTORY=app.services.team_advisor:TeamAdvisor
AKIM_ANALYSIS_VERSION=person3-v1
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini-2025-04-14
AKIM_AI_TIMEOUT_SECONDS=40
AKIM_AI_MAX_OUTPUT_TOKENS=2800
AKIM_ANALYSIS_TIMEOUT_SECONDS=45
```

A copy is provided in `backend/person3.env.example`. Keep the API key server-side in `.env`, never in frontend variables or committed source. Environment variables already set in your shell take precedence over `.env`.

Start the backend from `backend/`:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

Run Person 1's frontend in API mode using its existing instructions. No frontend source change is needed. Submit five decisions, then the results page requests `POST /api/scenarios/{id}/analysis`. A successful provider response becomes `source: "ai"` through Person 2's existing API.

Selecting TeamAdvisor without a key fails at startup. Provider failures return an analysis error through the backend; the saved scenario and deterministic score remain available. There is no silent substitution of rule-based text for an AI response. For an explicitly offline demo, restore `AKIM_ADVISOR_FACTORY=app.services.ai_advisor:RuleBasedAdvisor`; that mode is labeled `rules`.

## How the assessment works

1. Person 2 enforces the budget, validates all decisions, computes scores and saves the scenario.
2. Person 2 searches affordable, improving single-decision replacements. These are tested alternatives, not a proof of global optimality.
3. Person 3 formats these saved results into a fact catalog and sends it to the provider with a strict JSON schema.
4. The provider writes a summary, strengths, risks, trade-offs and explanations for the supplied recommendations. Numeric claims must use placeholders such as `{{score.after}}`.
5. The adapter validates the output and replaces placeholders with trusted backend values. Person 2 attaches its own numeric recommendation fields.

The official simulation score never comes from the language model. Display facts are rounded to one decimal; underlying calculations retain precision. Scores are points, not percentages of real-world improvement.

The adapter allows at most two provider requests per analysis, shared between transient retries and one output-repair attempt. The total adapter timeout is 40 seconds by default, inside the backend's 45-second timeout. Refusals, incomplete output and authentication errors fail without a repair loop. Valid reports use the backend's existing cache. **Change `AKIM_ANALYSIS_VERSION` whenever changing the prompt, model or interpretation logic**, so a prior report is not reused.

## Verify

Run from the merged `backend/` folder:

```bash
python -m scripts.person3_validate_data
python -m scripts.person3_evaluate
python -m pytest -q
```

The delivered version passed 58 tests: 36 existing backend tests and 22 new Person 3 tests. New tests use mocked HTTP provider responses, including an end-to-end FastAPI analysis call and cache reuse. They do not demonstrate the quality or reliability of a real model's prose. No new browser test or live provider call was run for this add-on.

To test with your own API key and model access (up to two billable requests):

```bash
python -m scripts.person3_live_check --live
```

Then run a scenario in the frontend and review whether its explanation accurately describes the chosen initiatives, who benefits, budget trade-offs and model limitations. Check both a distributed and a concentrated allocation before the hackathon demonstration.

## Synthetic data and scoring

All users start with the same budget of 100 virtual units and the same six hypothetical districts. There are three measures per category, costing 10, 20 or 30 units. The five indicators have equal weights within each district. The city score is 80% population-weighted district average plus 20% lowest district score. Initial city score: 47.1375.

| Evaluation case | Cost | Final score | Lowest district score |
|---|---:|---:|---:|
| Distributed low-cost measures | 50 | 48.4225 | 45.4 |
| Distributed medium-cost measures | 100 | 49.8190 | 47.0 |
| Concentrated medium-cost measures | 100 | 49.2875 | 45.0 |

These deterministic cases show that budget size alone does not determine the score: district targeting matters. The ledger records the exact configured effects and trade-offs for every initiative. It documents assumptions; it does not provide empirical calibration.

Do not edit the shared v1 dataset midway through team comparisons. Introduce a new dataset version and configure its directory for future experiments; follow Person 2's version/fingerprint rules. If changing scoring logic, also change the engine version.

## Limitations

This is a synthetic teaching simulator, not an official Astana index, spending proposal or forecast. The model does not simulate implementation time or recurring operating costs. Equal indicator weights and the equity component are explicit design choices.

Schema and reference checks constrain numeric literals and candidate IDs; they cannot prove that all free-form prose is causally correct, or detect every unsupported claim (including numbers written as words). Human review remains necessary. The prompt asks the model to treat dataset labels as data, but that is not a comprehensive defense if untrusted datasets are introduced later.

Requests set `store: false`; this is not a promise of zero provider retention. The adapter does not log API keys, full prompts or provider response bodies. Keep operational secrets out of the synthetic data.

## Provider references

- [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4.1 mini model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini)

The configured model must support the Responses API and the supplied strict JSON schema. Live account access, network availability and provider behavior must be verified using your own key.
