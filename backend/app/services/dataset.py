import json
from pathlib import Path

from app.schemas import Configuration
from app.services.scoring import ENGINE_VERSION


def load_configuration(directory: Path) -> Configuration:
    """Read only the configured version; data errors stop startup instead of guessing."""
    with (directory / "model_config.json").open(encoding="utf-8") as source:
        data = json.load(source)
    for name in ("districts", "initiatives"):
        with (directory / f"{name}.json").open(encoding="utf-8") as source:
            data[name] = json.load(source)
    config = Configuration.model_validate(data)
    if config.engine_version != ENGINE_VERSION:
        raise ValueError(
            f"This code implements engine {ENGINE_VERSION}, not {config.engine_version}."
        )
    return config
