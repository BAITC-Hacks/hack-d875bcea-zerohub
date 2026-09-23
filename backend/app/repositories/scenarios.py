import hashlib
import json
import time

from app.database import Database
from app.errors import DomainError
from app.models import StoredScenario
from app.schemas import Analysis, Configuration, Scenario, ScenarioRequest


def canonical_json(value: dict) -> str:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )


def request_hash(request: ScenarioRequest) -> str:
    data = request.model_dump(mode="json")
    # Reordering the same decisions is the same operation for an idempotent retry.
    data["decisions"].sort(key=lambda d: (d["initiative_id"], d["district_id"]))
    return hashlib.sha256(canonical_json(data).encode()).hexdigest()


class ScenarioRepository:
    def __init__(self, database: Database):
        self.database = database

    def register_configuration(self, config: Configuration):
        fingerprint = hashlib.sha256(
            canonical_json(config.model_dump(mode="json")).encode()
        ).hexdigest()
        with self.database.transaction() as db:
            row = db.execute(
                "SELECT config_hash FROM dataset_registry WHERE dataset_version=? AND engine_version=?",
                (config.dataset_version, config.engine_version),
            ).fetchone()
            if row and row["config_hash"] != fingerprint:
                raise RuntimeError(
                    "This dataset/model version already exists with different content. "
                    "Create a new dataset version instead of changing the competition baseline."
                )
            db.execute(
                "INSERT OR IGNORE INTO dataset_registry VALUES (?, ?, ?)",
                (config.dataset_version, config.engine_version, fingerprint),
            )

    def get(self, scenario_id: str) -> StoredScenario:
        with self.database.connection() as db:
            row = db.execute(
                "SELECT scenario_json, config_json FROM scenarios WHERE id=?", (scenario_id,)
            ).fetchone()
        if row is None:
            raise DomainError("Scenario not found.", 404)
        return StoredScenario(
            result=Scenario.model_validate_json(row["scenario_json"]),
            configuration=Configuration.model_validate_json(row["config_json"]),
        )

    @staticmethod
    def _replay(row, fingerprint: str) -> Scenario | None:
        if row is None:
            return None
        if row["request_hash"] != fingerprint:
            raise DomainError("This Idempotency-Key was already used for different decisions.", 409)
        return Scenario.model_validate_json(row["scenario_json"])

    def replay(self, key: str | None, fingerprint: str) -> Scenario | None:
        if key is None:
            return None
        with self.database.connection() as db:
            row = db.execute("SELECT * FROM scenarios WHERE idempotency_key=?", (key,)).fetchone()
        return self._replay(row, fingerprint)

    def save(
        self, scenario: Scenario, config: Configuration, key: str | None, fingerprint: str
    ) -> Scenario:
        initiatives = {initiative.id: initiative for initiative in config.initiatives}
        with self.database.transaction() as db:
            if key is not None:
                existing = self._replay(
                    db.execute(
                        "SELECT * FROM scenarios WHERE idempotency_key=?", (key,)
                    ).fetchone(),
                    fingerprint,
                )
                if existing is not None:
                    return existing
            db.execute(
                """INSERT INTO scenarios
                (id, created_at, dataset_version, engine_version, initial_budget, total_cost,
                 baseline_score, final_score, scenario_json, config_json, idempotency_key, request_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    scenario.id,
                    scenario.created_at,
                    scenario.dataset_version,
                    scenario.engine_version,
                    scenario.initial_budget,
                    scenario.total_cost,
                    scenario.baseline.score,
                    scenario.final.score,
                    scenario.model_dump_json(),
                    config.model_dump_json(),
                    key,
                    fingerprint,
                ),
            )
            db.executemany(
                "INSERT INTO decisions VALUES (?, ?, ?, ?, ?)",
                [
                    (
                        scenario.id,
                        position,
                        initiatives[d.initiative_id].category.value,
                        d.initiative_id,
                        d.district_id,
                    )
                    for position, d in enumerate(scenario.decisions)
                ],
            )
        return scenario

    def claim_analysis(
        self, scenario_id: str, version: str, owner: str, lease_seconds: float
    ) -> tuple[str, Analysis | None]:
        now = time.time()
        with self.database.transaction() as db:
            row = db.execute(
                "SELECT * FROM analysis_reports WHERE scenario_id=? AND analysis_version=?",
                (scenario_id, version),
            ).fetchone()
            if row and row["status"] == "completed":
                return "completed", Analysis.model_validate_json(row["report_json"])
            if row and row["lease_until"] > now:
                return "pending", None
            db.execute(
                """INSERT INTO analysis_reports VALUES (?, ?, 'pending', ?, ?, NULL)
                ON CONFLICT(scenario_id, analysis_version) DO UPDATE SET
                status='pending', owner_token=excluded.owner_token,
                lease_until=excluded.lease_until, report_json=NULL""",
                (scenario_id, version, owner, now + lease_seconds),
            )
        return "claimed", None

    def finish_analysis(self, scenario_id: str, version: str, owner: str, report: Analysis):
        with self.database.connection() as db:
            cursor = db.execute(
                """UPDATE analysis_reports SET status='completed', report_json=?, owner_token=NULL,
                lease_until=0 WHERE scenario_id=? AND analysis_version=? AND owner_token=? AND status='pending'""",
                (report.model_dump_json(), scenario_id, version, owner),
            )
        if cursor.rowcount != 1:
            raise DomainError(
                "Analysis ownership changed. Retry to retrieve the current report.", 503
            )

    def release_analysis(self, scenario_id: str, version: str, owner: str):
        with self.database.connection() as db:
            db.execute(
                "DELETE FROM analysis_reports WHERE scenario_id=? AND analysis_version=? AND owner_token=? AND status='pending'",
                (scenario_id, version, owner),
            )
