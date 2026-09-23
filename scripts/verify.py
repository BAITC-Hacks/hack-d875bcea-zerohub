"""Run installed project checks without making live AI calls."""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--browser",
        action="store_true",
        help="Also run the real browser stack in rules and mocked AI modes",
    )
    args = parser.parse_args()
    npm = shutil.which("npm")
    node = shutil.which("node")
    if not npm or not node:
        parser.error("Install Node.js and npm first")
    env = {
        **os.environ,
        "VITE_DATA_MODE": "api",
        "VITE_API_BASE_URL": "/api",
        "AKIM_TEST_PYTHON": sys.executable,
        "AKIM_ADVISOR_FACTORY": "app.services.ai_advisor:RuleBasedAdvisor",
    }
    checks = [
        ([sys.executable, "-m", "pytest", "-q"], ROOT / "backend"),
        ([sys.executable, "-m", "scripts.person3_validate_data"], ROOT / "backend"),
        ([npm, "test"], ROOT / "frontend"),
        ([npm, "run", "build"], ROOT / "frontend"),
    ]
    if args.browser:
        checks += [
            ([node, "scripts/check-stack.mjs"], ROOT),
            ([node, "scripts/check-stack.mjs", "--mock-ai"], ROOT),
        ]
    for command, directory in checks:
        print("Running: " + " ".join(command), flush=True)
        subprocess.run(command, cwd=directory, env=env, check=True)
    print("All selected checks passed. No live AI requests were made.")


if __name__ == "__main__":
    main()
