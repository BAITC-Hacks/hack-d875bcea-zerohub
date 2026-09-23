import json
import shutil
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.errors import DomainError
from app.main import create_app
from app.schemas import Scenario


def test_result_survives_restart(settings, payload):
    with TestClient(create_app(settings)) as client:
        result = client.post("/api/scenarios", json=payload).json()
    with TestClient(create_app(settings)) as client:
        assert client.get(f"/api/scenarios/{result['id']}").json() == result


def test_concurrent_idempotent_create_is_saved_once(client, payload):
    def submit(_):
        return client.post(
            "/api/scenarios", json=payload, headers={"Idempotency-Key": "same-key-12345"}
        )

    with ThreadPoolExecutor(max_workers=4) as workers:
        responses = list(workers.map(submit, range(8)))
    assert all(r.status_code == 201 for r in responses)
    assert len({r.json()["id"] for r in responses}) == 1
    payload["decisions"].reverse()
    assert submit(0).json()["id"] == responses[0].json()["id"]
    payload["decisions"][0]["district_id"] = "district_06"
    assert submit(0).status_code == 409
    with client.app.state.database.connection() as db:
        assert db.execute("SELECT count(*) FROM scenarios").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM decisions").fetchone()[0] == 5


def test_database_transaction_rolls_back_both_tables(client, payload, config):
    saved = client.post("/api/scenarios", json=payload).json()
    saved["id"] = "must-not-persist"
    saved["decisions"][1] = saved["decisions"][0]
    with pytest.raises(sqlite3.IntegrityError):
        client.app.state.repository.save(
            Scenario.model_validate(saved), config, None, "invalid-test"
        )
    with pytest.raises(DomainError):
        client.app.state.repository.get("must-not-persist")
    with client.app.state.database.connection() as db:
        assert (
            db.execute(
                "SELECT count(*) FROM decisions WHERE scenario_id='must-not-persist'"
            ).fetchone()[0]
            == 0
        )


def test_version_fingerprint_and_archived_configuration(settings, payload, tmp_path):
    with TestClient(create_app(settings)) as client:
        result = client.post("/api/scenarios", json=payload).json()
        old_report = client.post(f"/api/scenarios/{result['id']}/analysis").json()
    data = tmp_path / "changed-data"
    shutil.copytree(settings.data_dir, data)
    districts = json.loads((data / "districts.json").read_text())
    districts[0]["population"] += 500
    (data / "districts.json").write_text(json.dumps(districts))
    changed_settings = replace(settings, data_dir=data)
    with (
        pytest.raises(RuntimeError, match="different content"),
        TestClient(create_app(changed_settings)),
    ):
        pass
    model = json.loads((data / "model_config.json").read_text())
    model["dataset_version"] = "v2"
    (data / "model_config.json").write_text(json.dumps(model))
    with TestClient(create_app(replace(changed_settings, analysis_version="new-report"))) as client:
        assert client.get("/api/config").json()["dataset_version"] == "v2"
        assert client.get(f"/api/scenarios/{result['id']}").json() == result
        # A newly generated report uses the archived configuration, not current v2.
        assert client.post(f"/api/scenarios/{result['id']}/analysis").json() == old_report
