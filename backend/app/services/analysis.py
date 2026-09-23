import asyncio
import logging
from time import monotonic
from uuid import uuid4

from app.config import Settings
from app.errors import DomainError
from app.models import StoredScenario
from app.repositories.scenarios import ScenarioRepository
from app.schemas import Analysis, Narrative
from app.services.ai_advisor import Advisor, AnalysisContext
from app.services.recommendations import find_recommendations
from app.services.scoring import ENGINE_VERSION

logger = logging.getLogger(__name__)


class AnalysisService:
    def __init__(self, repository: ScenarioRepository, advisor: Advisor, settings: Settings):
        self.repository = repository
        self.advisor = advisor
        self.timeout = settings.analysis_timeout_seconds
        self.version = (
            f"{type(advisor).__module__}.{type(advisor).__qualname__}"
            f":{advisor.source}:{settings.analysis_version}"
        )

    async def _generate(self, stored: StoredScenario) -> Analysis:
        if stored.configuration.engine_version != ENGINE_VERSION:
            raise DomainError(
                "This engine cannot generate new analysis for that archived model.", 409
            )
        candidates = await asyncio.to_thread(
            find_recommendations, stored.result, stored.configuration
        )
        # Providers receive copies. They cannot mutate authoritative scores or candidates.
        context = AnalysisContext(
            scenario=stored.result.model_copy(deep=True),
            configuration=stored.configuration.model_copy(deep=True),
            candidates=[candidate.model_copy(deep=True) for candidate in candidates],
        )
        narrative = Narrative.model_validate(await self.advisor.analyze(context))
        known_ids = {candidate.candidate_id for candidate in candidates}
        if not set(narrative.recommendation_explanations) <= known_ids:
            raise ValueError("Advisor referenced an untested recommendation.")
        explained = [
            candidate.model_copy(
                update={
                    "explanation": narrative.recommendation_explanations.get(
                        candidate.candidate_id, candidate.explanation
                    )
                }
            )
            for candidate in candidates
        ]
        return Analysis(
            source=self.advisor.source,
            summary=narrative.summary,
            strengths=narrative.strengths,
            risks=narrative.risks,
            tradeoffs=narrative.tradeoffs,
            recommendations=explained,
        )

    async def analyze(self, scenario_id: str) -> Analysis:
        stored = await asyncio.to_thread(self.repository.get, scenario_id)
        owner = str(uuid4())
        deadline = monotonic() + self.timeout + 3
        # A SQLite lease deduplicates concurrent requests across workers, not just one event loop.
        while True:
            state, cached = await asyncio.to_thread(
                self.repository.claim_analysis, scenario_id, self.version, owner, self.timeout + 10
            )
            if state == "completed":
                assert cached is not None
                return cached
            if state == "claimed":
                break
            if monotonic() >= deadline:
                raise DomainError("Analysis is still running. Retry shortly.", 503)
            await asyncio.sleep(0.1)
        try:
            report = await asyncio.wait_for(self._generate(stored), timeout=self.timeout)
            await asyncio.to_thread(
                self.repository.finish_analysis, scenario_id, self.version, owner, report
            )
            return report
        except asyncio.CancelledError:
            await asyncio.shield(
                asyncio.to_thread(
                    self.repository.release_analysis, scenario_id, self.version, owner
                )
            )
            raise
        except Exception as error:
            await asyncio.to_thread(
                self.repository.release_analysis, scenario_id, self.version, owner
            )
            if isinstance(error, DomainError):
                raise
            # Provider exception text may contain credentials or prompt contents. Do not log it.
            logger.warning("Analysis failed (%s).", type(error).__name__)
            raise DomainError(
                "Analysis is temporarily unavailable. Your calculated scenario is saved; retry analysis shortly.",
                503,
            ) from None
