import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.dataset import load_configuration

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "data" / "v1"


def fixture_json(name):
    return json.loads((ROOT / "tests" / "fixtures" / name).read_text())


@pytest.fixture
def config():
    return load_configuration(DATA)


@pytest.fixture
def payload():
    return fixture_json("scenario-request.json")


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=DATA, database_path=tmp_path / "test.sqlite3")


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as session:
        yield session


def assert_numeric_tree(actual, expected):
    if isinstance(expected, dict):
        assert set(actual) == set(expected)
        for key in expected:
            assert_numeric_tree(actual[key], expected[key])
    elif isinstance(expected, list):
        assert len(actual) == len(expected)
        for a, b in zip(actual, expected, strict=True):
            assert_numeric_tree(a, b)
    elif isinstance(expected, (int, float)) and not isinstance(expected, bool):
        assert actual == pytest.approx(expected, abs=1e-9)
    else:
        assert actual == expected
