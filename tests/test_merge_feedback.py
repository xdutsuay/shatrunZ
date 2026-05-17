from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_merge_feedback_applies_penalize_and_reward(tmp_path):
    root = Path(__file__).parent.parent
    brain = {
        "name": "test",
        "memory": {"h1": {"e2e4": 5}},
        "values": {"h1": 0.0},
        "stats": {"wins": 0, "losses": 0, "draws": 0, "games": 0},
        "timestamp": 0,
        "version": 4,
    }
    brain_path = tmp_path / "in.json"
    brain_path.write_text(json.dumps(brain), encoding="utf-8")

    labels = tmp_path / "labels.ndjson"
    labels.write_text(
        "\n".join(
            [
                json.dumps({"position_hash": "h1", "move_uci": "e2e4", "penalize": True, "weight": 10}),
                json.dumps({"position_hash": "h2", "move_uci": "d2d4", "penalize": False, "weight": 10, "reward_if_not_bad": 4}),
            ]
        ),
        encoding="utf-8",
    )

    out = tmp_path / "out.json"
    cmd = [
        sys.executable,
        str(root / "tools" / "merge_feedback_into_brain.py"),
        "--brain",
        str(brain_path),
        "--labels",
        str(labels),
        "--out",
        str(out),
    ]
    assert subprocess.run(cmd, cwd=str(root), check=False).returncode == 0

    merged = json.loads(out.read_text(encoding="utf-8"))
    assert merged["memory"]["h1"]["e2e4"] == -5  # 5 - 10
    assert merged["memory"]["h2"]["d2d4"] == 4
