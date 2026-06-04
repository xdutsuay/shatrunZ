"""Run policy-net retraining as a background subprocess with a live log stream.

One job at a time. A job:
  1. Exports a fresh games.jsonl from the SQLite store (tools/export_ml.py).
  2. Runs ml.train on it (behavior-cloning the policy/value net).
Stdout from both steps is captured line-by-line into a ring buffer that the
/api/ml/train/stream SSE endpoint tails. On completion a run summary is written to
data/training_runs/run_<ts>.json so it appears in the existing Training runs list.
"""

from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parent.parent
EXPORT_TOOL = ROOT / "tools" / "export_ml.py"
RUNS_DIR = ROOT / "data" / "training_runs"
EXPORT_JSONL = ROOT / "data" / "exports" / "train_games.jsonl"
MODEL_OUT = ROOT / "models" / "policy_v1.pt"


class TrainingJob:
    def __init__(self, params: dict[str, Any]):
        self.params = params
        self.id = datetime.now().strftime("policy_%Y%m%d_%H%M%S")
        self.status = "starting"  # starting | running | done | failed
        self.started_at = time.time()
        self.ended_at: float | None = None
        self.error: str | None = None
        self.lines: deque[str] = deque(maxlen=2000)
        self._cv = threading.Condition()
        self._proc: subprocess.Popen | None = None

    def _emit(self, line: str) -> None:
        with self._cv:
            self.lines.append(line.rstrip("\n"))
            self._cv.notify_all()

    def _run_step(self, argv: list[str], label: str) -> int:
        self._emit(f"$ {label}")
        self._proc = subprocess.Popen(
            argv, cwd=str(ROOT), stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1,
        )
        for line in self._proc.stdout:  # type: ignore[union-attr]
            self._emit(line)
        self._proc.wait()
        return self._proc.returncode or 0

    def run(self) -> None:
        self.status = "running"
        try:
            only_decisive = bool(self.params.get("only_decisive"))
            export_argv = [sys.executable, str(EXPORT_TOOL), "--jsonl", str(EXPORT_JSONL)]
            if only_decisive:
                export_argv.append("--only-decisive")
            if self._run_step(export_argv, "export games from SQLite") != 0:
                raise RuntimeError("export step failed")

            train_argv = [
                sys.executable, "-m", "ml.train",
                "--games-jsonl", str(EXPORT_JSONL),
                "--out", str(MODEL_OUT),
                "--epochs", str(int(self.params.get("epochs", 3))),
                "--max-games", str(int(self.params.get("max_games", 200))),
            ]
            rc = self._run_step(train_argv, "train policy net")
            if rc != 0:
                raise RuntimeError(f"train step exited {rc}")
            self.status = "done"
            self._emit("[done] training complete")
        except Exception as exc:  # noqa: BLE001
            self.status = "failed"
            self.error = str(exc)
            self._emit(f"[failed] {exc}")
        finally:
            self.ended_at = time.time()
            self._write_summary()
            with self._cv:
                self._cv.notify_all()

    def _write_summary(self) -> None:
        RUNS_DIR.mkdir(parents=True, exist_ok=True)
        summary = {
            "id": self.id,
            "kind": "policy_net",
            "status": self.status,
            "error": self.error,
            "params": self.params,
            "started_at": datetime.fromtimestamp(self.started_at).isoformat(timespec="seconds"),
            "duration_sec": round((self.ended_at or time.time()) - self.started_at, 1),
        }
        try:
            (RUNS_DIR / f"run_{self.id}.json").write_text(
                json.dumps(summary, indent=2), encoding="utf-8"
            )
        except OSError:
            pass

    def snapshot(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "status": self.status,
            "error": self.error,
            "params": self.params,
            "started_at": datetime.fromtimestamp(self.started_at).isoformat(timespec="seconds"),
            "lines": list(self.lines)[-200:],
        }

    def stream(self) -> Iterator[str]:
        """Yield log lines as they arrive, then a final status line; ends with sentinel."""
        idx = 0
        while True:
            with self._cv:
                while idx >= len(self.lines) and self.status in ("starting", "running"):
                    self._cv.wait(timeout=30)
                snapshot = list(self.lines)
                done = self.status in ("done", "failed")
            while idx < len(snapshot):
                yield snapshot[idx]
                idx += 1
            if done and idx >= len(snapshot):
                yield f"__STATUS__ {self.status}"
                return


_current: TrainingJob | None = None
_lock = threading.Lock()


def start_job(params: dict[str, Any]) -> tuple[bool, str]:
    global _current
    with _lock:
        if _current and _current.status in ("starting", "running"):
            return False, _current.id
        job = TrainingJob(params)
        _current = job
    threading.Thread(target=job.run, daemon=True).start()
    return True, job.id


def current_job() -> TrainingJob | None:
    return _current
