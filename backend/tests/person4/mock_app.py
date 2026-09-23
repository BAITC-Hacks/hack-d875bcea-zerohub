"""Test-only HTTP provider fixture. Never use for a real AI demonstration."""

import json

import httpx

from app.ai.evidence import Evidence, Fact
from app.ai.settings import AISettings
from app.main import create_app
from app.services.team_advisor import TeamAdvisor
from tests.person3.test_advisor import draft_for, envelope


def make_app():
    def handle(request):
        body = json.loads(request.content)
        facts = json.loads(body["input"][0]["content"])["scenario_evidence"]
        evidence = Evidence(
            facts={key: Fact(**value) for key, value in facts["facts"].items()},
            candidates=facts["candidate_references"],
        )
        return httpx.Response(200, json=envelope(draft_for(evidence)))

    return create_app(
        advisor=TeamAdvisor(
            AISettings(api_key="test-only-not-a-real-key"), httpx.MockTransport(handle)
        )
    )
