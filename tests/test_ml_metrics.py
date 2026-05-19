"""ML metrics JSON schema validation."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
METRICS = ROOT / "models" / "metrics_v1.json"


def test_metrics_v1_schema():
    assert METRICS.is_file()
    data = json.loads(METRICS.read_text(encoding="utf-8"))
    assert data["version"] == 1
    for key in ("top1_accuracy", "top3_accuracy", "precision", "recall", "positions_evaluated"):
        assert key in data


def test_eval_script_writes_metrics(tmp_path):
    import subprocess
    import sys

    out = tmp_path / "metrics_test.json"
    r = subprocess.run(
        [sys.executable, str(ROOT / "ml" / "eval.py"), "--out", str(out)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    assert "version" in data
    assert "note" in data or data.get("positions_evaluated", 0) >= 0
