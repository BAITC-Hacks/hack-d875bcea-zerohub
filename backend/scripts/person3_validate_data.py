"""Run from backend: python -m scripts.person3_validate_data"""

import json
from pathlib import Path

from app.ai.evaluation import make_context
from app.services.dataset import load_configuration

ROOT = Path(__file__).resolve().parents[2]


def validate():
    config = load_configuration(ROOT / "data/v1")
    ledger = json.loads((ROOT / "data/person3/initiative_assumptions.json").read_text())
    assert len(ledger) == len(config.initiatives)
    by_id = {row["initiative_id"]: row for row in ledger}
    assert set(by_id) == {i.id for i in config.initiatives}
    for initiative in config.initiatives:
        row = by_id[initiative.id]
        assert row["cost_units"] == initiative.cost
        assert row["effects"] == initiative.effects.model_dump()
        assert row["tradeoffs"] == initiative.tradeoffs
    cases = json.loads((ROOT / "data/person3/evaluation_cases.json").read_text())
    contexts = [(case["name"], make_context(case["request"], config)) for case in cases]
    assert len({context.scenario.final.score for _, context in contexts}) > 1
    return contexts


if __name__ == "__main__":
    contexts = validate()
    print(
        f"Validated dataset, assumption ledger, and {len(contexts)} affordable complete scenarios."
    )
