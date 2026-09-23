import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import ScenarioRequest
from app.services.ai_advisor import RuleBasedAdvisor
from app.services.simulation import simulate


def test_honest_report_and_verified_single_decision_recommendations(client, payload, config):
    result = client.post("/api/scenarios", json=payload).json()
    response = client.post(f"/api/scenarios/{result['id']}/analysis")
    assert response.status_code == 200
    report = response.json()
    assert report["source"] == "rules"
    assert report["recommendations"]
    for candidate in report["recommendations"]:
        replay = simulate(
            ScenarioRequest(dataset_version="v1", decisions=candidate["decisions"]),
            config,
            require_complete=True,
        )
        assert candidate["score"] == replay.final.score
        assert candidate["total_cost"] == replay.total_cost <= 100
        assert candidate["score"] > result["final"]["score"]
        assert (
            sum(a != b for a, b in zip(candidate["decisions"], result["decisions"], strict=True))
            == 1
        )
    assert client.post(f"/api/scenarios/{result['id']}/analysis").json() == report


class CountingAdvisor(RuleBasedAdvisor):
    def __init__(self):
        self.calls = 0

    async def analyze(self, context):
        self.calls += 1
        await asyncio.sleep(0.1)
        return await super().analyze(context)


def test_concurrent_analysis_uses_one_provider_call(settings, payload):
    advisor = CountingAdvisor()
    with TestClient(create_app(settings, advisor)) as client:
        result = client.post("/api/scenarios", json=payload).json()

        def analyze(_):
            return client.post(f"/api/scenarios/{result['id']}/analysis")

        with ThreadPoolExecutor(max_workers=4) as workers:
            responses = list(workers.map(analyze, range(4)))
        assert all(r.status_code == 200 for r in responses)
        assert all(r.json() == responses[0].json() for r in responses)
        assert advisor.calls == 1


def test_provider_failure_does_not_destroy_result_and_retry_works(settings, payload):
    class FailingOnce(RuleBasedAdvisor):
        def __init__(self):
            self.calls = 0

        async def analyze(self, context):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("pretend-provider-secret")
            return await super().analyze(context)

    with TestClient(create_app(settings, FailingOnce())) as client:
        result = client.post("/api/scenarios", json=payload).json()
        path = f"/api/scenarios/{result['id']}"
        failed = client.post(path + "/analysis")
        assert failed.status_code == 503
        assert "pretend-provider-secret" not in failed.text
        assert client.get(path).json() == result
        assert client.post(path + "/analysis").status_code == 200


def test_provider_timeout_releases_claim(settings, payload):
    with TestClient(
        create_app(replace(settings, analysis_timeout_seconds=0.02), CountingAdvisor())
    ) as client:
        result = client.post("/api/scenarios", json=payload).json()
        assert client.post(f"/api/scenarios/{result['id']}/analysis").status_code == 503
        with client.app.state.database.connection() as db:
            assert db.execute("SELECT count(*) FROM analysis_reports").fetchone()[0] == 0


def test_unknown_candidate_reference_is_rejected(settings, payload):
    class UnknownCandidate(RuleBasedAdvisor):
        async def analyze(self, context):
            report = await super().analyze(context)
            return report.model_copy(
                update={"recommendation_explanations": {"made-up": "invented"}}
            )

    with TestClient(create_app(settings, UnknownCandidate())) as client:
        result = client.post("/api/scenarios", json=payload).json()
        assert client.post(f"/api/scenarios/{result['id']}/analysis").status_code == 503


def test_expired_analysis_lease_can_be_recovered(client, payload):
    result = client.post("/api/scenarios", json=payload).json()
    repo = client.app.state.repository
    version = client.app.state.analysis.version
    assert repo.claim_analysis(result["id"], version, "crashed-worker", -1)[0] == "claimed"
    assert client.post(f"/api/scenarios/{result['id']}/analysis").status_code == 200
