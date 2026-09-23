import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def local_path(value: str) -> Path:
    path = Path(value).expanduser()
    return (path if path.is_absolute() else BACKEND_ROOT / path).resolve()


@dataclass(frozen=True)
class Settings:
    data_dir: Path = BACKEND_ROOT.parent / "data" / "v1"
    database_path: Path = BACKEND_ROOT / "var" / "akim.sqlite3"
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    advisor_factory: str = "app.services.ai_advisor:RuleBasedAdvisor"
    analysis_version: str = "1"
    analysis_timeout_seconds: float = 45.0

    def __post_init__(self):
        if not 0 < self.analysis_timeout_seconds <= 50:
            raise ValueError("Analysis timeout must be greater than 0 and at most 50 seconds.")
        if not self.analysis_version.strip():
            raise ValueError("An analysis version is required.")

    @classmethod
    def from_environment(cls) -> "Settings":
        load_dotenv(BACKEND_ROOT / ".env", override=False)
        return cls(
            data_dir=local_path(os.getenv("AKIM_DATA_DIR", "../data/v1")),
            database_path=local_path(os.getenv("AKIM_DATABASE_PATH", "var/akim.sqlite3")),
            cors_origins=tuple(
                origin.strip().rstrip("/")
                for origin in os.getenv(
                    "AKIM_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
                ).split(",")
                if origin.strip()
            ),
            advisor_factory=os.getenv("AKIM_ADVISOR_FACTORY", cls.advisor_factory),
            analysis_version=os.getenv("AKIM_ANALYSIS_VERSION", "1"),
            analysis_timeout_seconds=float(os.getenv("AKIM_ANALYSIS_TIMEOUT_SECONDS", "45")),
        )
