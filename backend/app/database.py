import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS dataset_registry (
    dataset_version TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    config_hash TEXT NOT NULL,
    PRIMARY KEY (dataset_version, engine_version)
);
CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    dataset_version TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    initial_budget INTEGER NOT NULL CHECK (initial_budget > 0),
    total_cost INTEGER NOT NULL CHECK (total_cost >= 0 AND total_cost <= initial_budget),
    baseline_score REAL NOT NULL,
    final_score REAL NOT NULL,
    scenario_json TEXT NOT NULL,
    config_json TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    request_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
    scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 4),
    category TEXT NOT NULL CHECK (category IN ('transport','greening','social','safety','services')),
    initiative_id TEXT NOT NULL,
    district_id TEXT NOT NULL,
    PRIMARY KEY (scenario_id, category),
    UNIQUE (scenario_id, position)
);
CREATE TABLE IF NOT EXISTS analysis_reports (
    scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    analysis_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','completed')),
    owner_token TEXT,
    lease_until REAL NOT NULL,
    report_json TEXT,
    PRIMARY KEY (scenario_id, analysis_version)
);
CREATE INDEX IF NOT EXISTS scenarios_created_at ON scenarios(created_at);
"""


class Database:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        # Each operation owns its connection. Never share a connection across request threads.
        connection = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=5000")
        try:
            yield connection
        finally:
            connection.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                yield connection
                connection.commit()
            except BaseException:
                connection.rollback()
                raise

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise RuntimeError(f"Unsupported database schema version: {version}.")
            connection.execute("PRAGMA journal_mode=WAL")
            connection.executescript(
                "BEGIN IMMEDIATE;\n" + SCHEMA + "\nPRAGMA user_version=1;\nCOMMIT;"
            )

    def check(self):
        with self.connection() as connection:
            connection.execute("SELECT 1 FROM scenarios LIMIT 1").fetchone()
