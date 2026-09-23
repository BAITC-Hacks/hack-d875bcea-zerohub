import pytest

from app.errors import DomainError
from app.schemas import Configuration, ScenarioRequest
from app.services.simulation import simulate


@pytest.mark.parametrize("boundary", [0, 100])
def test_entire_model_stays_within_score_boundaries(config, boundary):
    data = config.model_dump()
    for district in data["districts"]:
        district["indicators"] = dict.fromkeys(district["indicators"], boundary)
    result = simulate(
        ScenarioRequest(dataset_version="v1", decisions=[]), Configuration.model_validate(data)
    )
    assert result.final.score == pytest.approx(boundary)
    assert result.final.city_average == pytest.approx(boundary)


def test_ineligible_target_is_rejected(config, payload):
    data = config.model_dump()
    initiative = next(i for i in data["initiatives"] if i["id"] == "transport_bus_priority")
    initiative["eligible_district_ids"] = ["district_02"]
    with pytest.raises(DomainError, match="not eligible"):
        simulate(ScenarioRequest.model_validate(payload), Configuration.model_validate(data))
