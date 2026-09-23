from fastapi import APIRouter, Request

from app.schemas import Configuration

router = APIRouter(tags=["Configuration"])


@router.get("/config", response_model=Configuration)
def configuration(request: Request):
    """Identical starting budget, model, districts and initiatives for every user."""
    return request.app.state.configuration
