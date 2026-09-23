# Person 3: connect the AI without changing the frontend

Person 2's implementation is complete and runs with `RuleBasedAdvisor`. Your work is to supply the live model integration and, if agreed by the team, improve the synthetic dataset. The API contract and calculated-score fields should remain stable.

## What the backend gives you

Implement an advisor factory (a no-argument class constructor is sufficient) in an importable backend module. It must expose:

```python
source = "ai"  # only if a real model generates the narrative

async def analyze(self, context: AnalysisContext) -> Narrative:
    ...
```

The exact classes live in `app.services.ai_advisor` and `app.schemas`.

`context` contains:

- `scenario`: the original saved five decisions, accepted spending, baseline and final district indicators, and calculated scores.
- `configuration`: the saved dataset/model snapshot used for that result, including initiatives and qualitative trade-offs.
- `candidates`: up to three affordable, higher-scoring single-decision alternatives that the backend has already simulated.

`context.as_dict()` produces JSON-serializable data. You receive deep copies, so provider code cannot alter the authoritative stored data or the backend's candidate objects.

## What to return

Return `Narrative` (or a dictionary that validates as that model):

```json
{
  "summary": "Explain the calculated outcome in plain language.",
  "strengths": ["A strength supported by the provided indicators."],
  "risks": ["A remaining gap or an explicit model limitation."],
  "tradeoffs": ["A consequence grounded in the selected initiative assumptions."],
  "recommendation_explanations": {}
}
```

To explain a candidate, put its exact `candidate_id` in `recommendation_explanations` and use a string as the value. Only IDs supplied in `context.candidates` are allowed. Leave the mapping empty to use the backend's existing candidate explanations. Do not add numeric `score`, `cost`, `decisions`, `source` or `recommendations` fields to this narrative schema.

The backend adds source/status metadata and assembles the final `Analysis` response. It retains its own candidate decisions, scores and costs. It rejects invented candidate IDs and malformed narratives with an explicit analysis-unavailable response.

## Implementation responsibilities

1. Select a provider/model using the team's available credentials.
2. Build a grounded prompt from `context.as_dict()`. Explain the before/after values and main trade-offs; label hypothetical impacts as assumptions.
3. Call the provider asynchronously using its supported client. Set a provider timeout shorter than the backend's 45-second default.
4. Decode and validate structured output as `Narrative`; avoid returning raw markdown or unparsed JSON strings.
5. Check that claims and referenced numbers match the context. Backend schemas protect numeric result fields, but cannot prove that free-form prose is factually faithful.
6. Set `source="ai"` only for actual model-generated narrative. For a deliberate deterministic implementation, use `source="rules"`.

Do not use blocking network calls or long CPU loops inside `async def analyze`. Cancellation must propagate; do not swallow `asyncio.CancelledError`. Use bounded provider retries within the total timeout. Manage any provider client with an async context manager inside the call, or supply a lifecycle design before introducing a persistent client.

## Activate your implementation

For example, if Person 3 defines `TeamAdvisor` in `app/services/team_advisor.py`, configure:

```dotenv
AKIM_ADVISOR_FACTORY=app.services.team_advisor:TeamAdvisor
AKIM_ANALYSIS_VERSION=2
```

Restart the backend. Put your provider credentials in the backend environment or ignored `.env` file. Do not put them in a `VITE_*` value or commit them to source control.

Increment `AKIM_ANALYSIS_VERSION` when changing the model, prompt or narrative logic. Existing reports for the old analysis version stay stored; the endpoint will generate and cache a report under the new version.

The endpoint returns a completed report synchronously. The frontend's analysis timeout is 60 seconds; the backend enforces a configurable timeout of at most 50 seconds. If you need longer jobs, coordinate a new job/status API with Person 1 before changing this response shape.

## Failure and caching behavior

On provider failure, timeout, schema failure or unknown candidate ID, the endpoint returns 503. The saved scenario and calculated results remain available. The failed report is not cached, so the user's Retry analysis action can try again. Exceptions are not exposed to the frontend, and the central service logs only the exception type.

The default behavior does not silently switch a failed AI request to the rule-based advisor. If the team wants a disclosed fallback policy, design it explicitly so the final `source` stays truthful; the current Advisor contract declares one source per configured advisor.

A database lease deduplicates concurrent calls for the same scenario and analysis version, including React StrictMode's repeated effects. Crashed leases expire. External-provider exactly-once billing is not guaranteed across crashes.

## Dataset changes

The included `data/v1/` exactly matches Person 1's fixture. Each category has three options, and each initiative has all five numeric effect keys, even when some are zero.

To change data:

1. Copy the folder to a new version and update `model_config.json`'s `dataset_version`.
2. Maintain valid IDs, positive populations, nonnegative integer costs and a feasible five-decision plan.
3. Keep weights nonnegative and summing to one.
4. Point `AKIM_DATA_DIR` at the new directory; restart and run the tests.
5. Update the agreed contract fixtures if the team intentionally changes the baseline. Do not silently replace the golden v1 files while claiming unchanged results.

Backend API mode sends the active configuration to the frontend, so UI choices do not need to be hardcoded again. The old frontend demo mode will still use its bundled v1 data unless Person 1 updates it separately. Saved scenarios retain their original data snapshots.

## Definition of done for Person 3

- A real model returns valid, clear, grounded narrative through `/api/scenarios/{id}/analysis`.
- The response says `source: "ai"` and the frontend shows the AI report.
- All recommendation IDs are tested candidates from the backend.
- Provider failure leaves calculated results intact and supports retry.
- Credentials are configured outside source control.
- Provider/model requirements, launch procedure, costs and limitations are documented by the team.
