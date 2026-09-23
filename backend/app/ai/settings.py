import os
from dataclasses import dataclass, field

from app.config import BACKEND_ROOT
from dotenv import load_dotenv


@dataclass(frozen=True)
class AISettings:
    api_key: str = field(repr=False)
    model: str = "gpt-4.1-mini-2025-04-14"
    total_timeout: float = 40.0
    max_output_tokens: int = 2800

    def __post_init__(self):
        if not self.api_key.strip() or any(c.isspace() for c in self.api_key):
            raise ValueError(
                "Set OPENAI_API_KEY in the backend environment before enabling TeamAdvisor."
            )
        if not self.model.strip():
            raise ValueError("OPENAI_MODEL must not be empty.")
        if not 0 < self.total_timeout <= 45:
            raise ValueError(
                "AKIM_AI_TIMEOUT_SECONDS must be greater than zero and at most 45."
            )
        if not 512 <= self.max_output_tokens <= 6000:
            raise ValueError("AKIM_AI_MAX_OUTPUT_TOKENS must be between 512 and 6000.")

    @classmethod
    def from_environment(cls):
        load_dotenv(BACKEND_ROOT / ".env", override=False)
        settings = cls(
            api_key=os.getenv("OPENAI_API_KEY", "").strip(),
            model=os.getenv("OPENAI_MODEL", cls.model).strip(),
            total_timeout=float(os.getenv("AKIM_AI_TIMEOUT_SECONDS", "40")),
            max_output_tokens=int(os.getenv("AKIM_AI_MAX_OUTPUT_TOKENS", "2800")),
        )
        backend_timeout = float(os.getenv("AKIM_ANALYSIS_TIMEOUT_SECONDS", "45"))
        if settings.total_timeout > backend_timeout - 2:
            raise ValueError(
                "The AI timeout must leave at least two seconds inside the backend analysis timeout."
            )
        return settings
