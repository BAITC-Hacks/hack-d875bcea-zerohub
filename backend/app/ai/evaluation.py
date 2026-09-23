from app.schemas import Scenario, ScenarioRequest
from app.services.ai_advisor import AnalysisContext
from app.services.recommendations import find_recommendations
from app.services.simulation import simulate


def make_context(payload, configuration):
    request = ScenarioRequest.model_validate(payload)
    preview = simulate(request, configuration, require_complete=True)
    scenario = Scenario(
        **preview.model_dump(),
        id="offline-evaluation",
        created_at="2026-01-01T00:00:00Z",
        decisions=request.decisions,
    )
    return AnalysisContext(
        scenario=scenario,
        configuration=configuration,
        candidates=find_recommendations(scenario, configuration),
    )
