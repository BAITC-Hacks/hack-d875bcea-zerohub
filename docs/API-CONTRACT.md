# Frontend ↔ backend contract

Base path: `/api`. All request/response bodies are JSON. Field names are snake_case. `src/types/simulation.ts` is the executable contract. The files in `contracts/` are concrete examples. Frontend API mode performs no local authoritative simulation.

## GET /config

Return the full configuration in `contracts/config-response.json`. It combines the project's model config, districts and initiatives into one response.

Required top-level fields: `dataset_version`, `engine_version`, `initial_budget`, `required_decisions` (5), `indicator_weights`, `city_average_weight`, `lowest_district_weight`, `districts`, `initiatives`.

Category identifiers are **transport, greening, social, safety, services**. Every indicator and district score is 0–100 with higher meaning better. All populations are positive integers. Budget and costs are nonnegative integer virtual units; the starting budget is positive. IDs are unique. Weights are nonnegative and sum to 1 in their respective groups.

District: `{id, name, population, indicators}`. Each initiative: `{id, category, name, description, cost, eligible_district_ids, effects, tradeoffs}`. Both indicators and effects have all five category keys. Effects may be negative. Trade-offs are an array of strings.

## POST /preview

Request: `{dataset_version, decisions: [{initiative_id, district_id}, ...]}` with 0–5 decisions and no repeated categories. The client never sends an accepted score, budget, cost or effect.

Return:

```text
dataset_version: string
engine_version: string
decision_count: integer 0..5
complete: boolean (true exactly when there are five valid decisions)
initial_budget: positive integer
total_cost: nonnegative integer
remaining_budget: nonnegative integer
baseline: ScoreSnapshot
final: ScoreSnapshot
```

`ScoreSnapshot` has `districts` (each district plus `score`), `city_average`, `lowest_district`, and `score`. Both snapshots must contain the same district IDs and populations from the versioned configuration. The field `final` represents the projected outcome for a partial preview and the accepted outcome for a saved scenario.

Recompute from the immutable baseline on every call. Add all effects before clipping, so selection order cannot change results. Never save invalid or over-budget previews. Return a 4xx error with a clear `detail` for invalid requests.

## POST /scenarios

Same request shape, but exactly five decisions covering all categories are required. Validate the budget, category coverage, eligibility, IDs and dataset version on the server even if the UI already checked them.

Return HTTP 200 or 201 with all preview fields plus:

```text
id: unique string
created_at: ISO-8601 timestamp
decisions: the five accepted decisions
complete: true
decision_count: 5
```

Store an immutable result snapshot and model/data versions. Save the scenario and decisions atomically. Consider an idempotency mechanism for a network timeout/retry; the UI prevents concurrent double-click submissions but cannot resolve uncertain server commits by itself.

## GET /scenarios/{id}

Return the same saved-scenario shape. Return 404 for an unknown ID. Old result snapshots should remain readable even if current config has moved to another version. The frontend disables editing against a different model version.

## POST /scenarios/{id}/analysis

This implementation expects one completed JSON response, within 60 seconds. Do not return a job ID or a `pending` report without first updating the frontend to poll a status endpoint. The request has no body.

```text
status: "completed"
source: "ai" | "rules"
summary: string
strengths: string[]
risks: string[]
tradeoffs: string[]
recommendations: Candidate[]
```

Candidate:

```text
candidate_id: unique string within this report
title: string
explanation: string
decisions: exactly five {initiative_id, district_id} objects
total_cost: integer
score: number 0..100
```

The backend evaluates candidate decisions and supplies their costs and scores. The AI may explain these candidates but must not invent their numeric results. Recommendations must use the saved scenario's dataset/engine version, be within budget and have one decision per category. Return `[]` if no improving alternative is found.

Use `source: "ai"` only when a model actually produced the narrative. Return `source: "rules"` for a disclosed deterministic fallback, or a non-2xx error if analysis is unavailable. Calculated results remain visible in either case.

Make this endpoint idempotent/cacheable by scenario ID and analysis version. React development StrictMode can mount effects twice; a repeated request should retrieve or join the same analysis instead of paying for two model calls. Never expose AI provider keys to the browser.

## Errors and transport

Use 400/422 for invalid input, 404 for unknown scenarios, 409 for incompatible dataset versions, and an appropriate 5xx for service failures. A simple body is `{"detail":"Human-readable explanation"}`. Standard FastAPI validation arrays with `detail[].msg` are also rendered.

Same-origin `/api` requests work through Vite's localhost:8000 development proxy. Production needs its own reverse proxy or an absolute backend URL. For cross-origin API URLs, allow the frontend origin and required methods/headers through CORS. No authentication mechanism is included; agree on one separately if the team adds accounts.

The integration browser tests mock these endpoints; they validate frontend behavior, not the real backend or an AI model.
