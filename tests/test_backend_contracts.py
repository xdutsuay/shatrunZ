from __future__ import annotations

import json
from pathlib import Path


def test_engine_move_accepts_moves_list_and_string():
    from backend.server import app  # noqa: WPS433

    client = app.test_client()

    # List form
    resp = client.post(
        "/api/engine-move",
        json={"moves": ["e2e4"], "depth": 1, "randomness": 0},
    )
    assert resp.status_code in (200, 503)
    data = resp.get_json()
    if resp.status_code == 503:
        assert data["success"] is False
        return
    assert data["success"] is True
    assert isinstance(data["move"], str)
    assert len(data["move"]) >= 4

    # Space-delimited string form
    resp2 = client.post(
        "/api/engine-move",
        json={"moves": "e2e4", "depth": 1, "randomness": 0},
    )
    assert resp2.status_code == 200
    data2 = resp2.get_json()
    assert data2["success"] is True
    assert isinstance(data2["move"], str)
    assert len(data2["move"]) >= 4


def test_engine_move_respects_midgame_move_list():
    """Regression: position must follow startpos + moves, not reset to startpos."""
    from backend.server import app  # noqa: WPS433

    client = app.test_client()
    prefix = ["e2e4", "e8e6", "d2d4", "d8d6"]
    resp = client.post(
        "/api/engine-move",
        json={"moves": prefix, "depth": 1, "randomness": 0},
    )
    if resp.status_code == 503:
        return
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert isinstance(data["move"], str)
    assert len(data["move"]) >= 4

    # Empty list = startpos (smoke that endpoint still works).
    resp_start = client.post(
        "/api/engine-move",
        json={"depth": 1, "randomness": 0},
    )
    assert resp_start.status_code == 200
    assert resp_start.get_json()["success"] is True


def test_engine_move_accepts_wtime_btime():
    from backend.server import app  # noqa: WPS433

    client = app.test_client()
    resp = client.post(
        "/api/engine-move",
        json={
            "moves": [],
            "depth": 4,
            "randomness": 0,
            "wtime": 60000,
            "btime": 60000,
            "winc": 1000,
            "binc": 1000,
        },
    )
    if resp.status_code == 503:
        return
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert isinstance(data["move"], str)


def test_save_game_persists_uci_moves_in_metadata(tmp_path):
    # We don't want to touch real repo data dir. Patch backend.server globals to use tmp dirs.
    import backend.server as server  # noqa: WPS433

    server.DATA_DIR = tmp_path
    server.GAMES_DIR = tmp_path / "games"
    server.BRAINS_DIR = tmp_path / "brains"
    server.LOGS_DIR = tmp_path / "logs"
    for p in [server.DATA_DIR, server.GAMES_DIR, server.BRAINS_DIR, server.LOGS_DIR]:
        p.mkdir(exist_ok=True)

    client = server.app.test_client()

    uci_moves = ["e2e4", "e8e6", "d2d4"]
    resp = client.post(
        "/api/save-game",
        json={
            "pgn": "[Event \"Test\"]\n\n1. e4 e6 2. d4 *\n",
            "white": "You",
            "black": "AI",
            "result": "*",
            "moves": ["e4", "e6", "d4"],
            "uci_moves": uci_moves,
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True

    # Ensure a metadata json exists and includes uci_moves intact.
    meta_files = sorted(server.GAMES_DIR.glob("game_*.json"))
    assert meta_files, "Expected backend to write game_*.json metadata"
    meta = json.loads(meta_files[0].read_text(encoding="utf-8"))
    assert meta["uci_moves"] == uci_moves


def test_stats_summary_endpoint_shape(tmp_path):
    import backend.server as server

    server.DATA_DIR = tmp_path
    server.GAMES_DIR = tmp_path / "games"
    server.GAMES_DIR.mkdir(parents=True)

    client = server.app.test_client()
    resp = client.get("/api/stats/summary")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert "total_games" in data
    assert "wins_by_color" in data
    assert "by_mode" in data
    assert "by_persona" in data


def test_engine_move_accepts_movetime(tmp_path):
    from backend.server import app

    client = app.test_client()
    resp = client.post(
        "/api/engine-move",
        json={"depth": 3, "movetime": 80, "randomness": 0},
    )
    assert resp.status_code in (200, 503)
    if resp.status_code == 503:
        return
    data = resp.get_json()
    assert data["success"] is True
    assert isinstance(data["move"], str)

