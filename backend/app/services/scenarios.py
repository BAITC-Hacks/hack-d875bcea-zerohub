from datetime import UTC, datetime
from uuid import uuid4

from app.repositories.scenarios import ScenarioRepository, request_hash
from app.schemas import Configuration, Scenario, ScenarioRequest
from app.services.simulation import simulate


def create_scenario(
    request: ScenarioRequest, config: Configuration, repository: ScenarioRepository, key: str | None
) -> Scenario:
    fingerprint = request_hash(request)
    existing = repository.replay(key, fingerprint)
    if existing is not None:
        return existing
    preview = simulate(request, config, require_complete=True)
    result = Scenario(
        **preview.model_dump(),
        id=str(uuid4()),
        created_at=datetime.now(UTC).isoformat(),
        decisions=request.decisions,
    )
    return repository.save(result, config, key, fingerprint)
