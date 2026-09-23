# Verification record

Verified on 2026-09-23 with Python 3.12.14, FastAPI 0.141.1, Pydantic 2.13.5 and SQLite from Python's standard library. All installed package versions are pinned in `requirements.lock`.

| Check | Result |
| --- | --- |
| Backend unit/API/storage/analysis tests | **36 passed** |
| Lint check and Python formatting | Passed |
| Installed dependency consistency (`pip check`) | Passed |
| Person 1's config and preview/final golden fixtures | Matched, allowing only floating-point tolerance |
| Live FastAPI responses parsed with Person 1's Zod schemas | Passed |
| Unchanged Person 1 frontend driven through a real browser against FastAPI + SQLite | Passed |
| Browser submit, reload saved result, refine allocation and compare plans | Passed |
| Generated OpenAPI schema | Included |

The real-browser test used no API interceptors. It ran the actual backend in a subprocess with an isolated SQLite database and the existing frontend in API mode. Default analysis was explicitly `source: "rules"`; no real language model was called. Person 3's live AI integration remains their responsibility.

Tests also verify over-budget rejection, input tampering, unknown/duplicate choices, version conflicts, clipping, eligible targets, score changes, immutable baseline behavior, persistence across restart, atomic rollback, concurrent idempotent creation, analysis deduplication, provider failure/timeouts, retry and lease recovery.

The Docker/Compose files were not executed. Cross-process analysis leases are implemented with SQLite transactions; the automated concurrent analysis test used several simultaneous requests in one application process, not a multi-host deployment.

The pinned Starlette test client emits a non-fatal deprecation warning about using `httpx` instead of `httpx2`. All tests complete successfully with the pinned dependencies. This affects the testing adapter, not an API response.

Browser tooling and Chromium are optional test dependencies supplied by Person 1's frontend environment. They are not included in this backend archive.
