#!/usr/bin/env python3
"""
Dumps engine/search.c's `search()` bestmove output (via `go depth N`,
untimed so it's the deterministic non-iterative path, randomness=0) for
the P3-analog parity gate (crates/shatrunz-core/tests/search_engine_parity.rs).
Reuses the same startpos + 15 seeded random-opening positions as
tools/c/perft_dump.py, read from the already-generated perft_engine
fixture so both gates exercise the same position set.

**Only depth 1 is dumped.** `search()`'s root call passes `INT_MIN`/
`INT_MAX` into `alphabeta`, which negates them before `alpha` has been
narrowed for depth >= 2 — signed-overflow UB in C. Empirically, this
manifests differently depending on how the *calling* code was compiled
(confirmed with two harnesses: one reimplementing search()'s loop inline,
one calling the real exported search() — same shipped alphabeta/
order_moves object code, different bestmove behavior at depth 3, at both
-O0 and -O3). There is no stable "real" bestmove to pin a test to for
depth >= 2, so shatrunz-core's search::engine deliberately uses safe
finite bounds instead of reproducing that UB — see its module doc for
the full writeup. Depth 1 doesn't hit this path (quiescence's stand-pat
check narrows alpha first) and is stable across independent rebuilds.

Usage:
    make -C engine
    python3 tools/c/search_engine_dump.py > crates/shatrunz-core/tests/fixtures/search_engine_fixture.json
"""
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ENGINE_BIN = REPO_ROOT / "engine" / "shatrunz_engine"
PERFT_FIXTURE = REPO_ROOT / "crates" / "shatrunz-core" / "tests" / "fixtures" / "perft_engine_fixture.json"

DEPTHS = [1]


class Engine:
    def __init__(self):
        self.proc = subprocess.Popen(
            [str(ENGINE_BIN)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1
        )
        self._send("uci")
        self._read_until("uciok")

    def _send(self, line):
        self.proc.stdin.write(line + "\n")
        self.proc.stdin.flush()

    def _read_until(self, marker):
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("engine closed stdout unexpectedly")
            if marker in line:
                return line

    def bestmove(self, path, depth):
        self._send("position startpos" + (" moves " + " ".join(path) if path else ""))
        self._send(f"go depth {depth}")
        line = self._read_until("bestmove")
        return line.strip().split()[1]

    def close(self):
        self._send("quit")
        self.proc.wait(timeout=5)


def main():
    if not ENGINE_BIN.exists():
        print(f"error: {ENGINE_BIN} not built — run `make -C engine` first", file=sys.stderr)
        sys.exit(1)

    perft_fixture = json.loads(PERFT_FIXTURE.read_text())
    engine = Engine()
    out = {"positions": []}

    entry = {"label": "startpos", "path": [], "bestmoves": {}}
    for depth in DEPTHS:
        entry["bestmoves"][f"depth{depth}"] = engine.bestmove([], depth)
    out["positions"].append(entry)

    for seeded in perft_fixture["seeded"]:
        path = seeded["path"]
        entry = {"label": f"seed{seeded['seed']}", "path": path, "bestmoves": {}}
        for depth in DEPTHS:
            entry["bestmoves"][f"depth{depth}"] = engine.bestmove(path, depth)
        out["positions"].append(entry)

    engine.close()
    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
