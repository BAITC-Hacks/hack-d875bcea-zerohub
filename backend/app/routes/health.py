from fastapi import APIRouter, Request

router = APIRouter(tags=["Operations"])


@router.get("/health")
def health(request: Request):
    request.app.state.database.check()
    config = request.app.state.configuration
    return {
        "status": "ok",
        "dataset_version": config.dataset_version,
        "engine_version": config.engine_version,
        "analysis_source": request.app.state.advisor.source,
    }
