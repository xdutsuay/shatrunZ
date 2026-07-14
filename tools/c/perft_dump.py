#!/usr/bin/env python3
"""
Dumps perft fixtures for the C engine's OWN move generator (rights-mode
castling + 4-way underpromotion — different from the JS variant's perft
in tools/js/perft.mjs), driving the built engine/shatrunz_engine binary
via its `position startpos moves ...` + `legal` UCI commands (there's no
native `perft` command, so each node is reconstructed by replaying its
full move path from startpos and asking for the legal move list).

For the P1-analog parity gate for shatrunz-core::engine_position
(crates/shatrunz-core/tests/perft_engine.rs).

Usage:
    make -C engine
    python3 tools/c/perft_dump.py > crates/shatrunz-core/tests/fixtures/perft_engine_fixture.json
"""
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ENGINE_BIN = REPO_ROOT / "engine" / "shatrunz_engine"


class Engine:
    def __init__(self):
        self.proc = subprocess.Popen(
            [str(ENGINE_BIN)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._send("uci")
        self._read_until("uciok")

    def _send(self, line):
        self.proc.stdin.write(line + "\n")
        self.proc.stdin.flush()

    def _read_until(self, marker):
        lines = []
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("engine closed stdout unexpectedly")
            lines.append(line.rstrip("\n"))
            if marker in line:
                return lines

    def legal_moves(self, path):
        self._send("position startpos" + (" moves " + " ".join(path) if path else ""))
        self._send("legal")
        line = self._read_until("legalmoves")[-1]
        rest = line[len("legalmoves"):].strip()
        return rest.split() if rest else []

    def close(self):
        self._send("quit")
        self.proc.wait(timeout=5)


def perft(engine, path, depth):
    if depth == 0:
        return 1
    moves = engine.legal_moves(path)
    nodes = 0
    for m in moves:
        nodes += perft(engine, path + [m], depth - 1)
    return nodes


def lcg(seed):
    state = seed
    while True:
        state = (state * 1103515245 + 12345) & 0x7FFFFFFF
        yield state


def random_opening(engine, rng, plies):
    path = []
    for _ in range(plies):
        moves = engine.legal_moves(path)
        if not moves:
            break
        idx = next(rng) % len(moves)
        path.append(moves[idx])
    return path


def main():
    if not ENGINE_BIN.exists():
        print(f"error: {ENGINE_BIN} not built — run `make -C engine` first", file=sys.stderr)
        sys.exit(1)

    engine = Engine()
    out = {"startpos": {}, "seeded": []}

    for depth in [1, 2, 3, 4]:
        out["startpos"][f"depth{depth}"] = perft(engine, [], depth)

    rng = lcg(42)
    for i in range(15):
        seed = 2000 + i
        plies = 2 + (seed % 4)
        path = random_opening(engine, rng, plies)
        depth = 2
        nodes = perft(engine, path, depth)
        out["seeded"].append({"seed": seed, "path": path, "depth": depth, "nodes": nodes})

    engine.close()
    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
