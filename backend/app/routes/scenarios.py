from typing import Annotated

from fastapi import APIRouter, Header, Request

from app.schemas import Preview, Scenario, ScenarioRequest
from app.services.scenarios import create_scenario
from app.services.simulation import simulate

router = APIRouter(tags=["Scenarios"])


@router.post("/preview", response_model=Preview)
def preview(body: ScenarioRequest, request: Request):
    """Calculate a partial or complete plan without writing it to the database."""
    return simulate(body, request.app.state.configuration)


@router.post("/scenarios", response_model=Scenario, status_code=201)
def create(
    body: ScenarioRequest,
    request: Request,
    idempotency_key: Annotated[str | None, Header(min_length=8, max_length=128)] = None,
):
    """Validate and atomically persist exactly five decisions plus their result snapshot."""
    return create_scenario(
        body, request.app.state.configuration, request.app.state.repository, idempotency_key
    )


@router.get("/scenarios/{scenario_id}", response_model=Scenario)
def retrieve(scenario_id: str, request: Request):
    return request.app.state.repository.get(scenario_id).result
