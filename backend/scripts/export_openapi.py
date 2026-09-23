"""Run from backend/: python -m scripts.export_openapi"""

import json
from pathlib import Path

from app.main import app

if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"
    target.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    print(target)
