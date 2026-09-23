import re

from app.ai.evidence import DISCLAIMER, Evidence
from app.ai.schemas import AnalysisDraft, Statement
from app.schemas import Narrative

TOKEN = re.compile(r"\{\{([A-Za-z][A-Za-z0-9_.-]*)\}\}")


class GroundingError(ValueError):
    """Safe, bounded feedback that may be sent to the model for one repair attempt."""


def render_statement(
    statement: Statement, evidence: Evidence, required: set[str] | None = None
) -> str:
    ids = statement.evidence_ids
    if len(ids) != len(set(ids)):
        raise GroundingError("Use each evidence ID only once per statement.")
    if not set(ids) <= evidence.facts.keys():
        raise GroundingError("Unknown evidence ID. Use only the supplied fact catalog.")
    tokens = set(TOKEN.findall(statement.text))
    if not tokens <= set(ids):
        raise GroundingError(
            "Every inline fact placeholder must also be listed in evidence_ids."
        )
    stripped = TOKEN.sub("", statement.text)
    if "{" in stripped or "}" in stripped:
        raise GroundingError(
            "Use exact double-brace placeholders with a valid fact ID."
        )
    if re.search(r"\d", stripped):
        raise GroundingError(
            "Do not type numeric literals. Insert numeric facts with double-brace placeholders."
        )
    if required and not required <= tokens:
        raise GroundingError(
            "Missing required numeric placeholders: "
            + ", ".join(sorted(required))
            + "."
        )
    return TOKEN.sub(
        lambda match: evidence.facts[match.group(1)].value, statement.text
    ).strip()


def to_narrative(draft: AnalysisDraft, evidence: Evidence) -> Narrative:
    summary = render_statement(
        draft.summary, evidence, {"budget.spent", "score.before", "score.after"}
    )
    ids = [recommendation.candidate_id for recommendation in draft.recommendations]
    if len(ids) != len(set(ids)) or set(ids) != evidence.candidates.keys():
        raise GroundingError(
            "Explain every supplied candidate exactly once, and never invent a candidate ID."
        )
    recommendations = {}
    for item in draft.recommendations:
        prefix = evidence.candidates[item.candidate_id]["prefix"]
        if any(
            ref.startswith("candidate.") and not ref.startswith(prefix + ".")
            for ref in item.evidence_ids
        ):
            raise GroundingError(
                "A recommendation must use only its own candidate's numeric facts."
            )
        recommendations[item.candidate_id] = render_statement(
            item, evidence, {prefix + ".score", prefix + ".gain", prefix + ".cost"}
        )
    return Narrative(
        summary=summary + " " + DISCLAIMER,
        strengths=[render_statement(item, evidence) for item in draft.strengths],
        risks=[render_statement(item, evidence) for item in draft.risks],
        tradeoffs=[render_statement(item, evidence) for item in draft.tradeoffs],
        recommendation_explanations=recommendations,
    )
