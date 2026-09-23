import asyncio
import copy
import json

import httpx
import pytest
from app.ai.evaluation import make_context
from app.ai.evidence import build_evidence
from app.ai.grounding import GroundingError, to_narrative
from app.ai.provider import ProviderError, extract_output
from app.ai.schemas import AnalysisDraft
from app.ai.settings import AISettings
from app.main import create_app
from app.services.team_advisor import TeamAdvisor
from fastapi.testclient import TestClient
from scripts.person3_validate_data import validate


def draft_for(evidence):
    def statement(text, ids):
        return {"text": text, "evidence_ids": ids}

    return {
        "summary": statement(
            "Spending {{budget.spent}} units changes the score from {{score.before}} to {{score.after}}.",
            ["budget.spent", "score.before", "score.after"],
        ),
        "strengths": [
            statement(
                "The remaining budget is {{budget.remaining}} units.",
                ["budget.remaining"],
            )
        ],
        "risks": [statement("{{model.limitations}}", ["model.limitations"])],
        "tradeoffs": [
            statement("The score balances {{model.formula}}.", ["model.formula"])
        ],
        "recommendations": [
            dict(
                candidate_id=key,
                **statement(
                    "This alternative scores {{"
                    + value["prefix"]
                    + ".score}} with a gain of {{"
                    + value["prefix"]
                    + ".gain}} points and total cost {{"
                    + value["prefix"]
                    + ".cost}} units.",
                    [
                        value["prefix"] + suffix
                        for suffix in (".score", ".gain", ".cost")
                    ],
                ),
            )
            for key, value in evidence.candidates.items()
        ],
    }


def envelope(draft):
    return {
        "status": "completed",
        "output": [
            {
                "type": "message",
                "content": [{"type": "output_text", "text": json.dumps(draft)}],
            }
        ],
    }


@pytest.fixture
def context(config, payload):
    return make_context(payload, config)


def test_grounded_output(context):
    evidence = build_evidence(context)
    narrative = to_narrative(
        AnalysisDraft.model_validate(draft_for(evidence)), evidence
    )
    assert str(context.scenario.total_cost) in narrative.summary
    assert f"{context.scenario.final.score:.1f}" in narrative.summary
    assert "{{" not in narrative.model_dump_json()
    assert set(narrative.recommendation_explanations) == set(evidence.candidates)


@pytest.mark.parametrize(
    "kind", ["number", "unknown", "missing", "braces", "candidate", "duplicate"]
)
def test_reject_ungrounded(context, kind):
    evidence = build_evidence(context)
    draft = draft_for(evidence)
    if kind == "number":
        draft["summary"]["text"] += " Guaranteed 99% improvement."
    if kind == "unknown":
        draft["summary"]["evidence_ids"].append("invented.fact")
    if kind == "missing":
        draft["summary"]["text"] = "No numeric facts."
    if kind == "braces":
        draft["summary"]["text"] += " {score.after}"
    if kind == "candidate":
        draft["recommendations"][0]["candidate_id"] = "invented"
    if kind == "duplicate":
        draft["summary"]["evidence_ids"].append("score.after")
    with pytest.raises(GroundingError):
        to_narrative(AnalysisDraft.model_validate(draft), evidence)


def test_empty_candidates(context):
    from app.services.ai_advisor import AnalysisContext

    context = AnalysisContext(context.scenario, context.configuration, [])
    evidence = build_evidence(context)
    assert (
        to_narrative(
            AnalysisDraft.model_validate(draft_for(evidence)), evidence
        ).recommendation_explanations
        == {}
    )


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"status": "incomplete"},
        {"status": "completed", "output": []},
        {
            "status": "completed",
            "output": [
                {"type": "message", "content": [{"type": "refusal", "refusal": "No"}]}
            ],
        },
    ],
)
def test_bad_provider_envelopes(body):
    with pytest.raises(ProviderError):
        extract_output(body)


def test_payload_and_retry(context):
    calls = []
    draft = draft_for(build_evidence(context))

    def handler(request):
        body = json.loads(request.content)
        calls.append(body)
        assert request.headers["authorization"] == "Bearer test-secret"
        assert body["store"] is False
        assert body["text"]["format"]["strict"] is True
        assert "test-secret" not in request.content.decode()
        if len(calls) == 1:
            return httpx.Response(429, headers={"retry-after": "0"})
        return httpx.Response(200, json=envelope(draft))

    advisor = TeamAdvisor(
        AISettings(api_key="test-secret"), httpx.MockTransport(handler)
    )
    assert asyncio.run(advisor.analyze(context)).summary
    assert len(calls) == 2
    assert "test-secret" not in repr(advisor.settings)


@pytest.mark.parametrize("first_bad", ["grounding", "schema"])
def test_one_repair(context, first_bad):
    calls = []
    draft = draft_for(build_evidence(context))
    bad = copy.deepcopy(draft)
    if first_bad == "grounding":
        bad["summary"]["text"] += " 999"
    else:
        bad.pop("summary")

    def handler(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json=envelope(bad if len(calls) == 1 else draft))

    advisor = TeamAdvisor(AISettings(api_key="test"), httpx.MockTransport(handler))
    asyncio.run(advisor.analyze(context))
    assert len(calls) == 2
    assert "validation_feedback" in calls[1]["input"][0]["content"]


@pytest.mark.parametrize("status,count", [(401, 1), (500, 2)])
def test_failure_bounded(context, status, count):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            status, headers={"retry-after": "0"}, text="sensitive-provider-body"
        )

    advisor = TeamAdvisor(AISettings(api_key="test"), httpx.MockTransport(handler))
    with pytest.raises(ProviderError) as error:
        asyncio.run(advisor.analyze(context))
    assert len(calls) == count
    assert "sensitive" not in str(error.value)


def test_total_timeout(context):
    async def handler(request):
        await asyncio.sleep(1)
        return httpx.Response(200, json={})

    advisor = TeamAdvisor(
        AISettings(api_key="test", total_timeout=0.01), httpx.MockTransport(handler)
    )
    with pytest.raises(TimeoutError):
        asyncio.run(advisor.analyze(context))


def test_backend_integration(settings, payload, context):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=envelope(draft_for(build_evidence(context))))

    advisor = TeamAdvisor(AISettings(api_key="test"), httpx.MockTransport(handler))
    with TestClient(create_app(settings, advisor)) as client:
        saved = client.post("/api/scenarios", json=payload)
        assert saved.status_code == 201
        scenario = saved.json()
        url = f"/api/scenarios/{scenario['id']}"
        result = client.post(url + "/analysis")
        assert result.status_code == 200, result.text
        assert result.json()["source"] == "ai"
        assert client.post(url + "/analysis").json() == result.json()
        assert len(calls) == 1
        assert client.get(url).json()["final"] == scenario["final"]


def test_backend_failure_keeps_scenario(settings, payload):
    advisor = TeamAdvisor(
        AISettings(api_key="test"),
        httpx.MockTransport(lambda request: httpx.Response(401)),
    )
    with TestClient(create_app(settings, advisor)) as client:
        scenario = client.post("/api/scenarios", json=payload).json()
        url = f"/api/scenarios/{scenario['id']}"
        assert client.post(url + "/analysis").status_code == 503
        assert client.get(url).status_code == 200


def test_strict_schema():
    schema = AnalysisDraft.model_json_schema()
    for obj in [schema, *schema["$defs"].values()]:
        if obj.get("type") == "object":
            assert obj["additionalProperties"] is False
            assert set(obj["required"]) == set(obj["properties"])


def test_dataset():
    assert len(validate()) == 3
