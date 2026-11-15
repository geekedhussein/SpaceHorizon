import json

from app import db
from app.main import create_app
from fastapi.testclient import TestClient

from .conftest import DESIGN


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_create_and_look_up_a_room(client):
    created = client.post("/api/rooms")
    assert created.status_code == 201
    body = created.json()
    assert set(body) == {"code", "seed"}
    assert 0 <= body["seed"] < 2**32

    info = client.get(f"/api/rooms/{body['code'].lower()}")
    assert info.json() == {"code": body["code"], "players": 0, "max_players": 4}
    assert client.get("/api/rooms/ZZZZZ").status_code == 404


def test_the_room_count_is_capped(settings):
    from dataclasses import replace

    with TestClient(create_app(replace(settings, max_rooms=1))) as client:
        assert client.post("/api/rooms").status_code == 201
        assert client.post("/api/rooms").status_code == 503


def test_save_and_load_a_design(client):
    saved = client.post("/api/designs", json={"scenario_id": "vegetation-monthly", "design": DESIGN})
    assert saved.status_code == 201
    design_id = saved.json()["id"]

    loaded = client.get(f"/api/designs/{design_id}").json()
    assert loaded["id"] == design_id
    assert loaded["scenario_id"] == "vegetation-monthly"
    assert loaded["design"] == DESIGN
    assert loaded["created_at"].endswith("+00:00")
    assert client.get("/api/designs/nope").status_code == 404


def test_a_malformed_design_is_refused(client):
    for design in [
        {**DESIGN, "orbitId": "DROP TABLE designs"},
        {**DESIGN, "extra": 1},
        {**DESIGN, "radioIds": "radio-sband-endurosat"},
        {**DESIGN, "imagingMinutesPerDay": -5},
    ]:
        refused = client.post("/api/designs", json={"scenario_id": "vegetation-monthly", "design": design})
        assert refused.status_code == 422, design


def test_an_oversized_request_is_refused(client, settings):
    big = {"scenario_id": "vegetation-monthly", "design": DESIGN, "padding": "x" * settings.max_body_bytes}
    assert client.post("/api/designs", json=big).status_code == 413


def submit(client, score, names=("Ada",), difficulty="concept", scenario="vegetation-monthly"):
    return client.post(
        "/api/leaderboard",
        json={
            "scenario_id": scenario,
            "difficulty": difficulty,
            "score": score,
            "design": DESIGN,
            "seed": 12345,
            "names": list(names),
        },
    )


def test_the_leaderboard_returns_the_top_rows_for_one_scenario_and_level(client, settings):
    for score in [40, 95.5, 70]:
        assert submit(client, score).status_code == 201
    submit(client, 99, difficulty="trade-study")
    submit(client, 98, scenario="another-scenario")

    rows = client.get("/api/leaderboard", params={"scenario_id": "vegetation-monthly", "difficulty": "concept"}).json()["rows"]
    assert [row["score"] for row in rows] == [95.5, 70, 40]
    assert rows[0]["names"] == ["Ada"]
    assert rows[0]["seed"] == 12345

    for _ in range(settings.leaderboard_rows + 5):
        submit(client, 10, names=("Ben", "Chen"))
    rows = client.get("/api/leaderboard", params={"scenario_id": "vegetation-monthly", "difficulty": "concept"}).json()["rows"]
    assert len(rows) == settings.leaderboard_rows


def test_a_leaderboard_row_out_of_range_is_refused(client):
    assert submit(client, 101).status_code == 422
    assert submit(client, -1).status_code == 422
    assert submit(client, 50, names=()).status_code == 422
    assert submit(client, 50, names=("A", "B", "C", "D", "E")).status_code == 422
    assert submit(client, 50, names=("x" * 25,)).status_code == 422
    assert submit(client, 50, difficulty="easy").status_code == 422
    assert client.get("/api/leaderboard", params={"scenario_id": "x", "difficulty": "easy"}).status_code == 422


def test_text_is_stored_as_data_not_run_as_sql(client, settings):
    name = "x'); DROP TABLE leaderboard;--"[:24]
    assert submit(client, 50, names=(name,)).status_code == 201
    rows = client.get("/api/leaderboard", params={"scenario_id": "vegetation-monthly", "difficulty": "concept"}).json()["rows"]
    assert rows[0]["names"] == [name]


def test_the_database_uses_wal_mode(client, settings):
    import sqlite3

    with sqlite3.connect(settings.db_path) as connection:
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert json.loads(json.dumps(db.top_scores(settings.db_path, "none", "concept", 5))) == []


def test_the_built_client_is_served_when_present(settings, tmp_path):
    from dataclasses import replace

    site = tmp_path / "dist"
    site.mkdir()
    (site / "index.html").write_text("<!doctype html><title>Space Horizon</title>")
    with TestClient(create_app(replace(settings, static_dir=site))) as client:
        assert "Space Horizon" in client.get("/").text
        # The API still answers ahead of the static files.
        assert client.get("/api/health").json() == {"status": "ok"}


def test_a_client_built_after_start_is_served(settings, tmp_path):
    from dataclasses import replace

    site = tmp_path / "built-later"
    with TestClient(create_app(replace(settings, static_dir=site))) as client:
        missing = client.get("/")
        assert missing.status_code == 503
        assert "npm run build" in missing.text
        site.mkdir()
        (site / "index.html").write_text("<p>game</p>")
        assert client.get("/").text == "<p>game</p>"
        assert client.get("/api/health").json() == {"status": "ok"}
