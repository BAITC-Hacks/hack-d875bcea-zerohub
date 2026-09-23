import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings
from app.database import Database
from app.errors import DomainError
from app.repositories.scenarios import ScenarioRepository
from app.routes import analysis, configuration, health, scenarios
from app.services.ai_advisor import Advisor, load_advisor
from app.services.analysis import AnalysisService
from app.services.dataset import load_configuration


def create_app(settings: Settings | None = None, advisor: Advisor | None = None) -> FastAPI:
    settings = settings or Settings.from_environment()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        config = load_configuration(settings.data_dir)
        database = Database(settings.database_path)
        database.initialize()
        repository = ScenarioRepository(database)
        repository.register_configuration(config)
        selected_advisor = (
            advisor if advisor is not None else load_advisor(settings.advisor_factory)
        )
        application.state.configuration = config
        application.state.database = database
        application.state.repository = repository
        application.state.advisor = selected_advisor
        application.state.analysis = AnalysisService(repository, selected_advisor, settings)
        yield

    application = FastAPI(
        title="Akim for 5 Hours API",
        version="1.0.0",
        description="Synthetic city simulation. Budget and scores are server-calculated. Default analysis is rule-based.",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Idempotency-Key"],
        allow_credentials=False,
    )

    @application.exception_handler(DomainError)
    async def domain_error(_request: Request, error: DomainError):
        return JSONResponse(
            status_code=error.status_code,
            content={"detail": error.detail},
            headers={"Retry-After": "1"} if error.status_code == 503 else None,
        )

    @application.exception_handler(sqlite3.OperationalError)
    async def database_error(_request: Request, _error: sqlite3.OperationalError):
        return JSONResponse(
            status_code=503,
            content={"detail": "Database is temporarily unavailable. Retry shortly."},
        )

    for router in (configuration.router, scenarios.router, analysis.router, health.router):
        application.include_router(router, prefix="/api")
    return application


app = create_app()
