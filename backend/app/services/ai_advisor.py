"""Person 3's extension boundary. The default advisor is explicitly rule-based."""

from dataclasses import dataclass
from importlib import import_module
from inspect import iscoroutinefunction
from typing import Literal, Protocol

from app.schemas import Candidate, Configuration, Narrative, Scenario


@dataclass(frozen=True)
class AnalysisContext:
    scenario: Scenario
    configuration: Configuration
    candidates: list[Candidate]

    def as_dict(self) -> dict:
        return {
            "scenario": self.scenario.model_dump(mode="json"),
            "configuration": self.configuration.model_dump(mode="json"),
            "candidates": [candidate.model_dump(mode="json") for candidate in self.candidates],
        }


class Advisor(Protocol):
    source: Literal["ai", "rules"]

    async def analyze(self, context: AnalysisContext) -> Narrative: ...


class RuleBasedAdvisor:
    source: Literal["rules"] = "rules"

    async def analyze(self, context: AnalysisContext) -> Narrative:
        scenario = context.scenario
        initial = {district.id: district.score for district in scenario.baseline.districts}
        gains = sorted(
            (
                (district, district.score - initial[district.id])
                for district in scenario.final.districts
            ),
            key=lambda pair: -pair[1],
        )
        lowest = min(scenario.final.districts, key=lambda district: district.score)
        untouched = [district.name for district, gain in gains if abs(gain) < 1e-8]
        initiatives = {
            initiative.id: initiative for initiative in context.configuration.initiatives
        }
        return Narrative(
            summary=(
                f"Your plan spends {scenario.total_cost} of {scenario.initial_budget} units and "
                f"changes the quality of life score from {scenario.baseline.score:.1f} to "
                f"{scenario.final.score:.1f}. This is a synthetic model result, not a forecast."
            ),
            strengths=[
                f"{gains[0][0].name} has the largest district-score improvement ({gains[0][1]:+.1f} points).",
                f"All five development areas have a decision, with {scenario.remaining_budget} budget units remaining.",
            ],
            risks=[
                f"{lowest.name} remains the lowest-scoring district at {lowest.score:.1f}.",
                f"{', '.join(untouched)} receive no net indicator improvement in this plan."
                if untouched
                else "All districts show a net change; check whether the gains are distributed fairly.",
                "The model does not estimate implementation time or recurring operating costs.",
            ],
            tradeoffs=[
                text
                for decision in scenario.decisions
                for text in initiatives[decision.initiative_id].tradeoffs
            ],
        )


def load_advisor(factory_path: str) -> Advisor:
    """Factory is operator configuration, never a client-supplied import path."""
    module_name, separator, name = factory_path.partition(":")
    if not separator or not module_name or not name:
        raise ValueError("AKIM_ADVISOR_FACTORY must have the form module.path:Factory.")
    advisor = getattr(import_module(module_name), name)()
    if getattr(advisor, "source", None) not in ("ai", "rules"):
        raise ValueError("Advisor must declare source='ai' or source='rules'.")
    if not iscoroutinefunction(getattr(advisor, "analyze", None)):
        raise ValueError("Advisor must implement async def analyze(context).")
    return advisor
