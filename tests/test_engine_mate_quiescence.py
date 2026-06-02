"""Engine tactical smoke: movetime path + wrapper eval (quiescence at depth 0)."""

from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
ENGINE_BIN = ROOT / "engine" / "shatrunz_engine"


@pytest.mark.skipif(not ENGINE_BIN.is_file(), reason="C engine not built")
def test_movetime_returns_legal_move():
    from engine.engine_wrapper import ShatrunZEngine

    eng = ShatrunZEngine(str(ENGINE_BIN))
    try:
        mv = eng.get_best_move(depth=1, movetime_ms=100)
        assert mv is not None
        assert len(mv) >= 4
    finally:
        eng.quit()


@pytest.mark.skipif(not ENGINE_BIN.is_file(), reason="C engine not built")
def test_eval_cp_startpos_near_zero():
    from engine.engine_wrapper import ShatrunZEngine

    eng = ShatrunZEngine(str(ENGINE_BIN))
    try:
        cp = eng.get_eval_cp()
        assert cp is not None
        assert abs(cp) < 500
    finally:
        eng.quit()
