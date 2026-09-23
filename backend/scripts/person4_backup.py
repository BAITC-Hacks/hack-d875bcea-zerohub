"""SQLite consistent online backup, including committed WAL data. Never overwrites a file."""

import argparse
import sqlite3
from contextlib import closing
from pathlib import Path


def backup(source: Path, target: Path):
    if not source.is_file():
        raise ValueError("Source database must exist")
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents accidental replacement of an earlier backup.
    with target.open("xb"):
        pass
    try:
        with (
            closing(sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True)) as original,
            closing(sqlite3.connect(target)) as destination,
        ):
            original.backup(destination)
            if destination.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Backup integrity check failed")
    except BaseException:
        target.unlink(missing_ok=True)
        raise
    print(f"Backup created: {target}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    backup(args.source, args.target)
