from fastapi import APIRouter, Request

from app.schemas import Analysis

router = APIRouter(tags=["Analysis"])


@router.post("/scenarios/{scenario_id}/analysis", response_model=Analysis)
async def analyze(scenario_id: str, request: Request):
    """Return a cached or newly generated, explicitly labeled assessment."""
    return await request.app.state.analysis.analyze(scenario_id)
