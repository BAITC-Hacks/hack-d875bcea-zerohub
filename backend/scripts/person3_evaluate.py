"""Deterministic evaluation only; does not call AI."""

import json

from scripts.person3_validate_data import validate

if __name__ == "__main__":
    print(
        json.dumps(
            [
                {
                    "case": name,
                    "cost": context.scenario.total_cost,
                    "baseline": context.scenario.baseline.score,
                    "score": context.scenario.final.score,
                    "lowest_district": context.scenario.final.lowest_district,
                    "tested_recommendations": len(context.candidates),
                }
                for name, context in validate()
            ],
            indent=2,
        )
    )
