from enum import StrEnum
from math import isclose
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

Identifier = Annotated[str, Field(strict=True, min_length=1, max_length=128)]
Point = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
Finite = Annotated[float, Field(allow_inf_nan=False)]
Units = Annotated[StrictInt, Field(ge=0)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Category(StrEnum):
    transport = "transport"
    greening = "greening"
    social = "social"
    safety = "safety"
    services = "services"


CATEGORIES = tuple(Category)


class Indicators(Model):
    transport: Point
    greening: Point
    social: Point
    safety: Point
    services: Point


class Effects(Model):
    transport: Finite
    greening: Finite
    social: Finite
    safety: Finite
    services: Finite


class District(Model):
    id: Identifier
    name: str
    population: Annotated[StrictInt, Field(gt=0)]
    indicators: Indicators


class Initiative(Model):
    id: Identifier
    category: Category
    name: str
    description: str
    cost: Units
    eligible_district_ids: Annotated[list[Identifier], Field(min_length=1)]
    effects: Effects
    tradeoffs: list[str]


class Configuration(Model):
    dataset_version: Identifier
    engine_version: Identifier
    initial_budget: Annotated[StrictInt, Field(gt=0)]
    required_decisions: Literal[5]
    indicator_weights: Effects
    city_average_weight: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
    lowest_district_weight: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
    districts: Annotated[list[District], Field(min_length=1)]
    initiatives: Annotated[list[Initiative], Field(min_length=5)]

    @model_validator(mode="after")
    def consistent_model(self) -> Self:
        weights = self.indicator_weights.model_dump().values()
        if any(w < 0 for w in weights) or not isclose(sum(weights), 1, abs_tol=1e-8):
            raise ValueError("Indicator weights must be nonnegative and sum to one.")
        if not isclose(self.city_average_weight + self.lowest_district_weight, 1, abs_tol=1e-8):
            raise ValueError("City score weights must sum to one.")
        district_ids = {d.id for d in self.districts}
        if len(district_ids) != len(self.districts):
            raise ValueError("Duplicate district IDs.")
        if len({i.id for i in self.initiatives}) != len(self.initiatives):
            raise ValueError("Duplicate initiative IDs.")
        for initiative in self.initiatives:
            if not set(initiative.eligible_district_ids) <= district_ids:
                raise ValueError("An initiative references an unknown district.")
        if {i.category for i in self.initiatives} != set(CATEGORIES):
            raise ValueError("All five categories need initiatives.")
        minimum_cost = sum(
            min(i.cost for i in self.initiatives if i.category == category)
            for category in CATEGORIES
        )
        if minimum_cost > self.initial_budget:
            raise ValueError("No complete five-decision plan can fit the budget.")
        return self


class Decision(Model):
    initiative_id: Identifier
    district_id: Identifier


class ScenarioRequest(Model):
    dataset_version: Identifier
    decisions: Annotated[list[Decision], Field(max_length=5)]


class ScoredDistrict(District):
    score: Point


class ScoreSnapshot(Model):
    districts: list[ScoredDistrict]
    city_average: Point
    lowest_district: Point
    score: Point


class Preview(Model):
    dataset_version: str
    engine_version: str
    decision_count: Annotated[int, Field(ge=0, le=5)]
    complete: bool
    initial_budget: int
    total_cost: Units
    remaining_budget: Units
    baseline: ScoreSnapshot
    final: ScoreSnapshot


class Scenario(Preview):
    id: str
    created_at: str
    decisions: Annotated[list[Decision], Field(min_length=5, max_length=5)]
    complete: Literal[True]
    decision_count: Literal[5]


class Candidate(Model):
    candidate_id: str
    title: str
    explanation: str
    decisions: Annotated[list[Decision], Field(min_length=5, max_length=5)]
    total_cost: Units
    score: Point


class Analysis(Model):
    status: Literal["completed"] = "completed"
    source: Literal["ai", "rules"]
    summary: str
    strengths: list[str]
    risks: list[str]
    tradeoffs: list[str]
    recommendations: list[Candidate]


class Narrative(Model):
    """Person 3 returns text only. Numeric candidate fields stay backend-owned."""

    summary: Annotated[str, Field(min_length=1)]
    strengths: list[str]
    risks: list[str]
    tradeoffs: list[str]
    recommendation_explanations: dict[str, str] = Field(default_factory=dict)
