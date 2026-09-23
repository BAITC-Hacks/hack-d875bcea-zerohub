from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Statement(StrictModel):
    text: Annotated[str, Field(min_length=1, max_length=700)]
    evidence_ids: Annotated[list[str], Field(min_length=1, max_length=12)]


class RecommendationStatement(Statement):
    candidate_id: str


class AnalysisDraft(StrictModel):
    """Provider-only schema. The frontend still receives Person 2's Narrative/Analysis."""

    summary: Statement
    strengths: Annotated[list[Statement], Field(min_length=1, max_length=3)]
    risks: Annotated[list[Statement], Field(min_length=1, max_length=3)]
    tradeoffs: Annotated[list[Statement], Field(min_length=1, max_length=5)]
    recommendations: Annotated[list[RecommendationStatement], Field(max_length=3)]
