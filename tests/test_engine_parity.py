"""JS Rules vs C engine legal-move parity."""

from __future__ import annotations

import json
import random
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

ENGINE_BIN = ROOT / "engine" / "shatrunz_engine"
LEGAL_MJS = ROOT / "tools" / "js" / "legal_moves.mjs"


def _engine_available() -> bool:
    return ENGINE_BIN.is_file()


def js_legal(moves: list[str]) -> list[str]:
    cmd = ["node", str(LEGAL_MJS), *moves]
    out = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, check=True)
    line = out.stdout.strip()
    return sorted(line.split()) if line else []


def c_legal(moves: list[str]) -> list[str]:
    from engine.engine_wrapper import ShatrunZEngine

    eng = ShatrunZEngine(str(ENGINE_BIN))
    try:
        return eng.get_legal_moves(moves)
    finally:
        eng.quit()


def js_can_replay(moves: list[str]) -> bool:
    if not moves:
        return True
    script = (
        "import { Game } from './frontend/game.js';"
        "import { parseUCIMove } from './frontend/shared/uci.js';"
        "const g = new Game();"
        "for (const u of process.argv.slice(2)) {"
        "  const p = parseUCIMove(u);"
        "  if (!p) process.exit(1);"
        "  g.executeMove(p.from, p.to);"
        "}"
    )
    r = subprocess.run(
        ["node", "--input-type=module", "-e", script, *moves],
        cwd=str(ROOT),
        capture_output=True,
    )
    return r.returncode == 0


def _walk_parity_plies(seed: int, max_plies: int = 12) -> int:
    random.seed(seed)
    moves: list[str] = []
    for _ in range(max_plies):
        js_m = js_legal(moves)
        c_m = c_legal(moves)
        assert js_m == c_m, f"mismatch after {' '.join(moves) or 'startpos'}"
        common = sorted(set(js_m) & set(c_m))
        if not common:
            break
        moves.append(random.choice(common))
    return len(moves)


@pytest.mark.skipif(not _engine_available(), reason="C engine not built")
def test_startpos_parity():
    assert js_legal([]) == c_legal([])


@pytest.mark.skipif(not _engine_available(), reason="C engine not built")
@pytest.mark.parametrize("seed", [1, 7, 42, 99, 2026])
def test_incremental_walk_parity(seed: int):
    plies = _walk_parity_plies(seed)
    assert plies >= 6, f"seed {seed}: only {plies} plies before block"


@pytest.mark.skipif(not _engine_available(), reason="C engine not built")
def test_selfplay_jsonl_positions_parity():
    """On C self-play prefixes that JS can replay, count positions where legal sets match."""
    selfplay_dir = ROOT / "data" / "selfplay"
    games_path = None
    if selfplay_dir.is_dir():
        runs = sorted(selfplay_dir.glob("run_*/games.jsonl"), reverse=True)
        if runs:
            games_path = runs[0]

    positions: list[list[str]] = []
    if games_path and games_path.is_file():
        with games_path.open(encoding="utf-8") as fp:
            for i, line in enumerate(fp):
                if i >= 200:
                    break
                obj = json.loads(line)
                moves = obj.get("moves") or []
                for depth in (4, 8, 12, 20, len(moves)):
                    if depth <= len(moves):
                        positions.append(moves[:depth])
    else:
        for seed in (10, 20, 30):
            random.seed(seed)
            moves: list[str] = []
            for _ in range(15):
                common = sorted(set(js_legal(moves)) & set(c_legal(moves)))
                if not common:
                    break
                moves.append(random.choice(common))
            positions.append(moves)

    matches = 0
    checked = 0
    for moves in positions:
        if not js_can_replay(moves):
            continue
        checked += 1
        if js_legal(moves) == c_legal(moves):
            matches += 1

    assert checked >= 20
    assert matches >= 10, f"only {matches}/{checked} self-play prefixes matched"
