from app.errors import DomainError
from app.schemas import CATEGORIES, Configuration, Decision, Initiative, ScenarioRequest


def validate_decisions(
    request: ScenarioRequest, config: Configuration, *, require_complete: bool = False
) -> list[tuple[Decision, Initiative]]:
    if request.dataset_version != config.dataset_version:
        raise DomainError("Dataset changed. Reload the configuration before continuing.", 409)
    if require_complete and len(request.decisions) != config.required_decisions:
        raise DomainError("Submit exactly one decision in each of the five categories.")
    initiatives = {initiative.id: initiative for initiative in config.initiatives}
    district_ids = {district.id for district in config.districts}
    seen = set()
    chosen = []
    for decision in request.decisions:
        initiative = initiatives.get(decision.initiative_id)
        if initiative is None:
            raise DomainError(f"Unknown initiative: {decision.initiative_id}.")
        if decision.district_id not in district_ids:
            raise DomainError(f"Unknown district: {decision.district_id}.")
        if initiative.category in seen:
            raise DomainError(f"Choose only one initiative in {initiative.category}.")
        if decision.district_id not in initiative.eligible_district_ids:
            raise DomainError(f"{initiative.name} is not eligible in that district.")
        seen.add(initiative.category)
        chosen.append((decision, initiative))
    if require_complete and seen != set(CATEGORIES):
        raise DomainError("Every category must have exactly one decision.")
    total_cost = sum(initiative.cost for _, initiative in chosen)
    if total_cost > config.initial_budget:
        raise DomainError(
            f"Plan costs {total_cost} units; the budget is {config.initial_budget}. "
            "Replace an initiative with a cheaper option."
        )
    return chosen
