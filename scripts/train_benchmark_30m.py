import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.server import engine as ENGINE  # noqa: E402


def main():
    minutes = float(os.environ.get("BENCH_MINUTES", "30"))
    depth = int(os.environ.get("BENCH_DEPTH", "5"))
    randomness = int(os.environ.get("BENCH_RANDOMNESS", "0"))
    out_dir = Path(__file__).resolve().parent.parent / "data" / "training_runs"
    out_dir.mkdir(parents=True, exist_ok=True)

    if ENGINE is None:
        raise RuntimeError("Engine is not available (backend.server.engine is None).")

    started = time.time()
    deadline = started + minutes * 60.0
    calls = 0
    failures = 0
    last_err = ""
    last_report = started

    # Benchmark is intentionally simple: repeated best-move calls from the starting position.
    # This gives us a stable throughput metric per build (moves/sec) without full self-play wiring.
    while time.time() < deadline:
        try:
            mv = ENGINE.get_best_move(fen=None, moves=[], depth=depth, randomness=randomness)
            if not mv:
                failures += 1
        except Exception as e:
            failures += 1
            last_err = str(e)
        calls += 1

        now = time.time()
        if now - last_report >= 10:
            elapsed = now - started
            print(f"[bench] {elapsed:0.0f}s calls={calls} failures={failures}", flush=True)
            last_report = now

    elapsed = time.time() - started
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    payload = {
        "id": f"run_{ts}",
        "kind": "engine_benchmark",
        "started_utc": ts,
        "minutes": minutes,
        "depth": depth,
        "randomness": randomness,
        "calls": calls,
        "failures": failures,
        "elapsed_seconds": round(elapsed, 2),
        "calls_per_second": round(calls / elapsed, 3) if elapsed > 0 else 0,
        "last_error": last_err,
    }

    out_path = out_dir / f"run_{ts}.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(str(out_path))


if __name__ == "__main__":
    main()

