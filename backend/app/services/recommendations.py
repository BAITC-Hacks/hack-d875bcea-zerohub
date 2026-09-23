from app.schemas import Candidate, Configuration, Decision, Scenario, ScenarioRequest
from app.services.simulation import simulate


def find_recommendations(
    scenario: Scenario, config: Configuration, limit: int = 3
) -> list[Candidate]:
    """Evaluate every eligible, affordable single-decision replacement. No global-optimum claim."""
    initiatives = {initiative.id: initiative for initiative in config.initiatives}
    districts = {district.id: district for district in config.districts}
    candidates = []
    for index, previous in enumerate(scenario.decisions):
        original = initiatives[previous.initiative_id]
        for alternative in config.initiatives:
            if alternative.category != original.category:
                continue
            if scenario.total_cost - original.cost + alternative.cost > config.initial_budget:
                continue
            for district_id in alternative.eligible_district_ids:
                if alternative.id == previous.initiative_id and district_id == previous.district_id:
                    continue
                decisions = list(scenario.decisions)
                decisions[index] = Decision(initiative_id=alternative.id, district_id=district_id)
                result = simulate(
                    ScenarioRequest(dataset_version=config.dataset_version, decisions=decisions),
                    config,
                    require_complete=True,
                )
                gain = result.final.score - scenario.final.score
                if gain <= 1e-8:
                    continue
                candidates.append(
                    Candidate(
                        candidate_id=f"{index}:{alternative.id}:{district_id}",
                        title=f"{alternative.name} in {districts[district_id].name}",
                        explanation=(
                            f"Replace {original.name} in {districts[previous.district_id].name}. "
                            f"This tested single-decision change improves your score by {gain:.1f} points."
                        ),
                        decisions=decisions,
                        total_cost=result.total_cost,
                        score=result.final.score,
                    )
                )
    return sorted(
        candidates,
        key=lambda candidate: (-candidate.score, candidate.total_cost, candidate.candidate_id),
    )[:limit]
