import copy

import pytest

from tests.conftest import assert_numeric_tree, fixture_json


def test_shared_config_health_and_docs(client):
    first = client.get("/api/config")
    assert first.status_code == 200
    assert_numeric_tree(first.json(), fixture_json("config-response.json"))
    assert client.get("/api/config").json() == first.json()
    assert client.get("/api/health").json()["analysis_source"] == "rules"
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/docs").status_code == 200


def test_empty_preview_is_valid_but_empty_submission_is_not(client):
    body = {"dataset_version": "v1", "decisions": []}
    result = client.post("/api/preview", json=body)
    assert result.status_code == 200
    assert result.json()["complete"] is False
    assert client.post("/api/scenarios", json=body).status_code == 422


def test_exact_budget_accepted_overrun_rejected_without_saving(client, payload):
    result = client.post("/api/scenarios", json=payload)
    assert result.status_code == 201
    assert result.json()["total_cost"] == 100
    assert result.json()["remaining_budget"] == 0
    payload["decisions"][0]["initiative_id"] = "transport_junction"
    assert client.post("/api/scenarios", json=payload).status_code == 422
    assert client.post("/api/preview", json=payload).status_code == 422
    with client.app.state.database.connection() as db:
        assert db.execute("SELECT count(*) FROM scenarios").fetchone()[0] == 1


@pytest.mark.parametrize(
    "case",
    [
        "duplicate",
        "four",
        "six",
        "unknown_initiative",
        "unknown_district",
        "fake_budget",
        "fake_cost",
        "fake_score",
        "numeric_id",
    ],
)
def test_invalid_or_tampered_requests_rejected(client, payload, case):
    if case == "duplicate":
        payload["decisions"][1] = copy.deepcopy(payload["decisions"][0])
    if case == "four":
        payload["decisions"].pop()
    if case == "six":
        payload["decisions"].append(copy.deepcopy(payload["decisions"][0]))
    if case == "unknown_initiative":
        payload["decisions"][0]["initiative_id"] = "invented"
    if case == "unknown_district":
        payload["decisions"][0]["district_id"] = "missing"
    if case == "fake_budget":
        payload["initial_budget"] = 10000
    if case == "fake_cost":
        payload["decisions"][0]["cost"] = 0
    if case == "fake_score":
        payload["final_score"] = 100
    if case == "numeric_id":
        payload["decisions"][0]["initiative_id"] = 1
    assert client.post("/api/scenarios", json=payload).status_code == 422


def test_wrong_version_and_unknown_result(client, payload):
    payload["dataset_version"] = "wrong"
    assert client.post("/api/scenarios", json=payload).status_code == 409
    assert client.get("/api/scenarios/missing").status_code == 404
    assert client.post("/api/scenarios/missing/analysis").status_code == 404


def test_cors_allows_frontend_origin_and_idempotency_header(client):
    response = client.options(
        "/api/scenarios",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,idempotency-key",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
