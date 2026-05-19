"""Self-play multiprocessing smoke tests."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "engine" / "shatrunz_engine"
SELFPLAY = ROOT / "tools" / "selfplay.py"


@pytest.mark.skipif(not ENGINE.is_file(), reason="C engine not built")
def test_selfplay_workers_produces_valid_jsonl(tmp_path):
    # Use serial mode in CI/sandbox; parallel path covered by test_selfplay_chunk.py
    workers = 1
    out = tmp_path / "run_test"
    cmd = [
        sys.executable,
        str(SELFPLAY),
        "--games",
        "4",
        "--max-plies",
        "30",
        "--workers",
        str(workers),
        "--out",
        str(out),
        "--report-every",
        "0",
    ]
    subprocess.run(cmd, cwd=str(ROOT), check=True, capture_output=True, text=True)
    games_path = out / "games.jsonl"
    assert games_path.is_file()
    lines = games_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 4
    for line in lines:
        obj = json.loads(line)
        assert "moves" in obj
        assert "result" in obj
        assert "white" in obj

    summary = json.loads((out / "summary.json").read_text(encoding="utf-8"))
    assert summary["games"] == 4
    assert summary["workers"] == workers
