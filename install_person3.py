"""Merge this add-on into a Person 2 project without overwriting different files."""

import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "project", type=Path, help="Project folder containing backend/ and data/"
)
args = parser.parse_args()
source = Path(__file__).resolve().parent
target = args.project.resolve()
if not (target / "backend/app/main.py").is_file():
    parser.error("Target must contain Person 2's backend/app/main.py")
files = [
    (p, target / p.relative_to(source))
    for folder in ("backend", "data")
    for p in (source / folder).rglob("*")
    if p.is_file() and "__pycache__" not in p.parts
]
conflicts = [
    str(dst)
    for src, dst in files
    if dst.exists() and src.read_bytes() != dst.read_bytes()
]
if conflicts:
    parser.error("Refusing to overwrite different files: " + ", ".join(conflicts))
for src, dst in files:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        shutil.copy2(src, dst)
print("Person 3 installed. Configure backend/.env using backend/person3.env.example.")
