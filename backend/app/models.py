from dataclasses import dataclass

from app.schemas import Configuration, Scenario


@dataclass(frozen=True)
class StoredScenario:
    result: Scenario
    configuration: Configuration
