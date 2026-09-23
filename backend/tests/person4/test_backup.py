import sqlite3

import pytest

from scripts.person4_backup import backup


def test_backup_includes_wal_and_refuses_overwrite(tmp_path):
    source = tmp_path / "source.sqlite3"
    target = tmp_path / "backup.sqlite3"
    with sqlite3.connect(source) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE sample(value TEXT)")
        db.execute("INSERT INTO sample VALUES ('saved')")
        db.commit()
        backup(source, target)
        with sqlite3.connect(target) as restored:
            assert restored.execute("SELECT value FROM sample").fetchone()[0] == "saved"
        with pytest.raises(FileExistsError):
            backup(source, target)


def test_missing_source_is_not_created(tmp_path):
    with pytest.raises(ValueError):
        backup(tmp_path / "absent", tmp_path / "target")
    assert not (tmp_path / "target").exists()
