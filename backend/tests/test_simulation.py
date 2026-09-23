import copy

import pytest
from pydantic import ValidationError

from app.schemas import Configuration, ScenarioRequest
from app.services.simulation import simulate
from tests.conftest import assert_numeric_tree, fixture_json


def test_frontend_golden_preview_and_final_match(config, payload):
    partial = simulate(ScenarioRequest.model_validate(fixture_json("preview-request.json")), config)
    assert_numeric_tree(partial.model_dump(mode="json"), fixture_json("preview-response.json"))
    complete = simulate(ScenarioRequest.model_validate(payload), config, require_complete=True)
    expected = fixture_json("completed-scenario.json")
    for key in ("id", "created_at", "decisions"):
        expected.pop(key)
    assert_numeric_tree(complete.model_dump(mode="json"), expected)


def test_independent_baseline_arithmetic_and_no_mutation(config, payload):
    original = config.model_dump()
    initial = simulate(ScenarioRequest(dataset_version="v1", decisions=[]), config)
    assert initial.total_cost == 0
    assert initial.remaining_budget == 100
    assert initial.final.city_average == pytest.approx(15335 / 320)
    assert initial.final.lowest_district == 44
    assert initial.final.score == pytest.approx(47.1375)
    first = simulate(ScenarioRequest.model_validate(payload), config)
    assert simulate(ScenarioRequest.model_validate(payload), config) == first
    payload["decisions"].reverse()
    assert simulate(ScenarioRequest.model_validate(payload), config) == first
    assert config.model_dump() == original


def test_changed_decisions_change_score(config, payload):
    first = simulate(ScenarioRequest.model_validate(payload), config)
    payload["decisions"][0]["initiative_id"] = "transport_bus_stops"
    second = simulate(ScenarioRequest.model_validate(payload), config)
    assert second.total_cost == 90
    assert second.final.score != first.final.score


def test_clipping_happens_after_all_effects(config, payload):
    data = config.model_dump()
    data["districts"][0]["indicators"]["transport"] = 95
    next(i for i in data["initiatives"] if i["id"] == "greening_pocket_park")["effects"][
        "transport"
    ] = -8
    revised = Configuration.model_validate(data)
    choices = copy.deepcopy(payload["decisions"][:2])
    choices[1]["district_id"] = "district_01"
    result = simulate(ScenarioRequest(dataset_version="v1", decisions=choices), revised)
    assert result.final.districts[0].indicators.transport == 99
    assert (
        simulate(ScenarioRequest(dataset_version="v1", decisions=choices[::-1]), revised) == result
    )
    data["districts"][0]["indicators"]["transport"] = 100
    capped = simulate(
        ScenarioRequest(dataset_version="v1", decisions=choices[:1]),
        Configuration.model_validate(data),
    )
    assert capped.final.districts[0].indicators.transport == 100
    data["districts"][0]["indicators"]["transport"] = 0
    floored = simulate(
        ScenarioRequest(dataset_version="v1", decisions=choices[1:]),
        Configuration.model_validate(data),
    )
    assert floored.final.districts[0].indicators.transport == 0


@pytest.mark.parametrize(
    "change", ["weights", "duplicates", "district_reference", "infeasible", "nonfinite"]
)
def test_invalid_dataset_rejected(config, change):
    data = config.model_dump()
    if change == "weights":
        data["indicator_weights"]["transport"] = -0.2
    if change == "duplicates":
        data["districts"].append(data["districts"][0])
    if change == "district_reference":
        data["initiatives"][0]["eligible_district_ids"] = ["missing"]
    if change == "infeasible":
        data["initial_budget"] = 1
    if change == "nonfinite":
        data["districts"][0]["indicators"]["transport"] = float("nan")
    with pytest.raises(ValidationError):
        Configuration.model_validate(data)
