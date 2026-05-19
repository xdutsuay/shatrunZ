"""Unit tests for self-play scheduling helpers (no subprocess)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.selfplay import EngineConfig, _build_game_specs, _chunk_specs


def test_chunk_specs_distributes_all_games():
    configs = [
        EngineConfig("a", "e", [], 3, 0),
        EngineConfig("b", "e", [], 3, 0),
    ]
    pairings = [(configs[0], configs[1])]
    specs = _build_game_specs(10, pairings, seed=1)
    chunks = _chunk_specs(specs, 3)
    flat = [s for c in chunks for s in c]
    assert len(flat) == 10
    assert {s["game"] for s in flat} == set(range(1, 11))
