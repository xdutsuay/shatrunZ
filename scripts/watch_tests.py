from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path


WATCH_DIRS = ["frontend", "backend", "engine", "tests", "tests-js"]
WATCH_EXTS = {".py", ".js", ".c", ".h", ".css", ".html", ".md"}


def iter_files(root: Path):
    for d in WATCH_DIRS:
        p = root / d
        if not p.exists():
            continue
        for path in p.rglob("*"):
            if path.is_file() and path.suffix in WATCH_EXTS:
                yield path


def snapshot(root: Path) -> dict[Path, float]:
    snap: dict[Path, float] = {}
    for f in iter_files(root):
        try:
            snap[f] = f.stat().st_mtime
        except FileNotFoundError:
            pass
    return snap


def changed(prev: dict[Path, float], curr: dict[Path, float]) -> bool:
    if prev.keys() != curr.keys():
        return True
    for k, v in curr.items():
        if prev.get(k) != v:
            return True
    return False


def run_tests(root: Path) -> int:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    # Opt-in frontend tests (Node) to keep the default workflow Python-only.
    extra = ""
    if env.get("RUN_FRONTEND_TESTS") == "1":
        extra = " && npm test --silent"
    cmd = ["bash", "-lc", f"source .venv/bin/activate >/dev/null 2>&1 || true; pytest -q{extra}"]
    print("\n=== Running tests ===")
    return subprocess.call(cmd, cwd=str(root), env=env)


def main():
    root = Path(__file__).resolve().parent.parent
    interval = 1.0
    prev = snapshot(root)
    print(f"Watching for changes in: {', '.join(WATCH_DIRS)}")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(interval)
            curr = snapshot(root)
            if changed(prev, curr):
                prev = curr
                code = run_tests(root)
                if code == 0:
                    print("✅ Tests passed")
                else:
                    print(f"❌ Tests failed (exit {code})")
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

