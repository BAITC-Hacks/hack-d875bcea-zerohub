import asyncio
from pathlib import Path
from typing import Literal

import httpx
from app.ai.evidence import build_evidence
from app.ai.grounding import GroundingError, to_narrative
from app.ai.provider import ProviderError, ResponsesProvider
from app.ai.schemas import AnalysisDraft
from app.ai.settings import AISettings
from app.schemas import Narrative
from app.services.ai_advisor import AnalysisContext
from pydantic import ValidationError

PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "person3_advisor.txt"


class TeamAdvisor:
    """Drop-in async Advisor for Person 2. Live API success is required; no silent fallback."""

    source: Literal["ai"] = "ai"

    def __init__(
        self,
        settings: AISettings | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.settings = settings or AISettings.from_environment()
        self.provider = ResponsesProvider(self.settings, transport)
        self.instructions = PROMPT_PATH.read_text(encoding="utf-8")

    async def analyze(self, context: AnalysisContext) -> Narrative:
        evidence = build_evidence(context)
        feedback = None
        # At most two HTTP calls, shared by transient retries and output repair.
        # Cancellation propagates to httpx; the backend's outer timeout remains authoritative.
        async with asyncio.timeout(self.settings.total_timeout):
            for attempt in range(2):
                try:
                    text = await self.provider.generate(
                        self.instructions,
                        evidence.prompt_data(),
                        AnalysisDraft.model_json_schema(),
                        feedback,
                    )
                    draft = AnalysisDraft.model_validate_json(text)
                    return to_narrative(draft, evidence)
                except ProviderError as error:
                    if not error.retryable or attempt == 1:
                        raise
                    await asyncio.sleep(error.retry_after)
                except ValidationError:
                    if attempt == 1:
                        raise GroundingError(
                            "Provider output still does not match the required assessment schema."
                        ) from None
                    feedback = "Return every required field in the supplied schema. Do not add fields or markdown."
                except GroundingError as error:
                    if attempt == 1:
                        raise
                    feedback = str(error)
        raise GroundingError("No valid assessment was generated.")
