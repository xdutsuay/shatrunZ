#!/usr/bin/env python3
"""
Dumps engine/evaluate.c's evaluate() output via the built UCI binary, for
the P2 parity gate (crates/shatrunz-core/tests/eval_engine_parity.rs).
Reuses the same startpos + 20 seeded-opening UCI move lists as
tools/js/eval_dump.mjs (read from the already-generated HCE fixture) so
both eval gates exercise the same position set.

Usage:
    make -C engine
    python3 tools/c/eval_dump.py > crates/shatrunz-core/tests/fixtures/eval_engine_fixture.json
"""
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ENGINE_BIN = REPO_ROOT / "engine" / "shatrunz_engine"
HCE_FIXTURE = REPO_ROOT / "crates" / "shatrunz-core" / "tests" / "fixtures" / "eval_hce_fixture.json"


def eval_position(uci_moves):
    cmds = ["uci", "isready"]
    if uci_moves:
        cmds.append("position startpos moves " + " ".join(uci_moves))
    else:
        cmds.append("position startpos")
    cmds += ["eval", "quit"]
    proc = subprocess.run(
        [str(ENGINE_BIN)],
        input="\n".join(cmds) + "\n",
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    )
    m = re.search(r"info score cp (-?\d+)", proc.stdout)
    if not m:
        raise RuntimeError(f"no eval score in engine output: {proc.stdout!r} (stderr: {proc.stderr!r})")
    return int(m.group(1))


def main():
    if not ENGINE_BIN.exists():
        print(f"error: {ENGINE_BIN} not built — run `make -C engine` first", file=sys.stderr)
        sys.exit(1)

    hce_fixture = json.loads(HCE_FIXTURE.read_text())
    out = {"positions": []}
    for entry in hce_fixture["positions"]:
        uci_moves = entry.get("uciMoves", [])
        score = eval_position(uci_moves)
        out["positions"].append({
            "label": entry["label"],
            "uciMoves": uci_moves,
            "score_cp": score,
        })

    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
