from app.schemas import CATEGORIES, Configuration, District, Preview, ScenarioRequest
from app.services.scoring import calculate_score
from app.services.validation import validate_decisions


def simulate(
    request: ScenarioRequest, config: Configuration, *, require_complete: bool = False
) -> Preview:
    chosen = validate_decisions(request, config, require_complete=require_complete)
    # Start from independent copies on every request. Accumulate, THEN clamp once.
    values = {district.id: district.indicators.model_dump() for district in config.districts}
    # Stable accumulation order also makes fractional-effect datasets reproducible.
    for decision, initiative in sorted(chosen, key=lambda pair: pair[1].category.value):
        for category in CATEGORIES:
            values[decision.district_id][category] += getattr(initiative.effects, category)
    updated = [
        District(
            id=district.id,
            name=district.name,
            population=district.population,
            indicators={
                key: max(0.0, min(100.0, value)) for key, value in values[district.id].items()
            },
        )
        for district in config.districts
    ]
    cost = sum(initiative.cost for _, initiative in chosen)
    return Preview(
        dataset_version=config.dataset_version,
        engine_version=config.engine_version,
        decision_count=len(chosen),
        complete=len(chosen) == config.required_decisions,
        initial_budget=config.initial_budget,
        total_cost=cost,
        remaining_budget=config.initial_budget - cost,
        baseline=calculate_score(config.districts, config),
        final=calculate_score(updated, config),
    )
