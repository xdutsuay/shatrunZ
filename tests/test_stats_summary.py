from __future__ import annotations

import json

from backend.stats import aggregate_games


def test_aggregate_games_empty_dir(tmp_path):
    games = tmp_path / "games"
    games.mkdir()
    out = aggregate_games(games)
    assert out["total_games"] == 0
    assert out["wins_by_color"]["white"]["games"] == 0


def test_aggregate_games_counts_result_and_persona(tmp_path):
    games = tmp_path / "games"
    games.mkdir()
    meta = {
        "white": "Material AI",
        "black": "Positional AI",
        "result": "1-0",
        "mode": "cvc",
    }
    (games / "game_20260101_120000.json").write_text(
        json.dumps(meta), encoding="utf-8"
    )
    (games / "game_20260101_120000.pgn").write_text(
        '[Event "T"]\n[Result "1-0"]\n\n*\n', encoding="utf-8"
    )

    out = aggregate_games(games)
    assert out["total_games"] == 1
    assert out["wins_by_color"]["white"]["wins"] == 1
    assert out["wins_by_color"]["black"]["losses"] == 1
    assert out["by_mode"]["cvc"]["white_wins"] == 1
    assert out["by_persona"]["material"]["wins"] == 1
    assert out["by_persona"]["positional"]["losses"] == 1


def test_stats_summary_api(tmp_path):
    import backend.server as server

    server.DATA_DIR = tmp_path
    server.GAMES_DIR = tmp_path / "games"
    server.GAMES_DIR.mkdir(parents=True)

    meta = {
        "white": "White",
        "black": "Aggressive AI",
        "result": "0-1",
        "mode": "hvc",
    }
    (server.GAMES_DIR / "game_x.json").write_text(json.dumps(meta), encoding="utf-8")

    client = server.app.test_client()
    resp = client.get("/api/stats/summary")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["total_games"] == 1
    assert data["wins_by_color"]["black"]["wins"] == 1
    assert data["by_mode"]["hvc"]["black_wins"] == 1
