"""SQLite storage for saved designs and leaderboard rows.

A file on disk, opened per request. Writes happen only on an explicit save
and on a leaderboard submit. Rooms are never stored.
"""

import json
import secrets
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS designs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    design_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    score REAL NOT NULL,
    names TEXT NOT NULL,
    design_json TEXT NOT NULL,
    seed INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leaderboard_top ON leaderboard (scenario_id, difficulty, score DESC);
"""


def _connect(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(path, timeout=5)


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def init_db(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(_connect(path)) as connection:
        # WAL lets readers carry on while a save is being written.
        connection.execute("PRAGMA journal_mode=WAL")
        connection.executescript(SCHEMA)
        connection.commit()


def save_design(path: Path, scenario_id: str, design: dict) -> str:
    design_id = secrets.token_urlsafe(8)
    with closing(_connect(path)) as connection:
        connection.execute(
            "INSERT INTO designs (id, scenario_id, design_json, created_at) VALUES (?, ?, ?, ?)",
            (design_id, scenario_id, json.dumps(design), _now()),
        )
        connection.commit()
    return design_id


def load_design(path: Path, design_id: str) -> dict | None:
    with closing(_connect(path)) as connection:
        row = connection.execute(
            "SELECT id, scenario_id, design_json, created_at FROM designs WHERE id = ?", (design_id,)
        ).fetchone()
    if row is None:
        return None
    return {"id": row[0], "scenario_id": row[1], "design": json.loads(row[2]), "created_at": row[3]}


def add_score(
    path: Path, scenario_id: str, difficulty: str, score: float, names: list[str], design: dict, seed: int
) -> int:
    with closing(_connect(path)) as connection:
        cursor = connection.execute(
            "INSERT INTO leaderboard (scenario_id, difficulty, score, names, design_json, seed, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (scenario_id, difficulty, score, json.dumps(names), json.dumps(design), seed, _now()),
        )
        connection.commit()
        return int(cursor.lastrowid)


def top_scores(path: Path, scenario_id: str, difficulty: str, limit: int) -> list[dict]:
    with closing(_connect(path)) as connection:
        rows = connection.execute(
            "SELECT id, score, names, seed, created_at FROM leaderboard"
            " WHERE scenario_id = ? AND difficulty = ?"
            " ORDER BY score DESC, id ASC LIMIT ?",
            (scenario_id, difficulty, limit),
        ).fetchall()
    return [
        {"id": row[0], "score": row[1], "names": json.loads(row[2]), "seed": row[3], "created_at": row[4]}
        for row in rows
    ]
