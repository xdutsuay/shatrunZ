"""Optional Fairy-Stockfish (external UCI) checks.

These run only when UCI_ENGINE_PATH points at a built variant engine, so CI without
the submodule stays green. They verify the engine answers the `shatrunz` variant and
that its bestmove is legal under the authoritative frontend rules (Krishna-safe).

Enable locally:
    git submodule update --init --recursive
    bash scripts/build_fairy_stockfish.sh
    export UCI_ENGINE_PATH="$PWD/engine/third_party/fairy-stockfish/src/stockfish"
    pytest tests/test_fairy_stockfish_optional.py -q
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

UCI_ENGINE_PATH = os.getenv("UCI_ENGINE_PATH")
VARIANT_INI = os.getenv(
    "SHATRUNZ_VARIANT_INI", str(ROOT / "engine" / "variants" / "shatrunz.ini")
)
LEGAL_MJS = ROOT / "tools" / "js" / "legal_moves.mjs"

requires_external = pytest.mark.skipif(
    not (UCI_ENGINE_PATH and Path(UCI_ENGINE_PATH).is_file()),
    reason="UCI_ENGINE_PATH not set to a built external engine",
)


def _init_commands() -> list[str]:
    return [
        f"setoption name VariantPath value {VARIANT_INI}",
        "setoption name UCI_Variant value shatrunz",
    ]


def _new_engine():
    from engine.engine_wrapper import ShatrunZEngine

    return ShatrunZEngine(UCI_ENGINE_PATH, init_commands=_init_commands())


def _js_legal(moves: list[str]) -> list[str]:
    out = subprocess.run(
        ["node", str(LEGAL_MJS), *moves],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=True,
    )
    line = out.stdout.strip()
    return sorted(line.split()) if line else []


@requires_external
def test_external_engine_returns_bestmove():
    eng = _new_engine()
    try:
        mv = eng.get_best_move(moves=[], depth=1)
        assert mv is not None
        assert len(mv) >= 4
        assert mv not in ("0000", "(none)", "none")
    finally:
        eng.quit()


@requires_external
@pytest.mark.skipif(shutil.which("node") is None, reason="node not available")
def test_external_bestmove_is_legal_in_frontend_rules():
    """Guard against silent rule drift (e.g. Krishna captures FS allows but ShatrunZ does not).

    Checks startpos and a couple of shallow prefixes where Krishna is not yet in play,
    so a failure here genuinely flags an engine/rules mismatch worth investigating.
    """
    prefixes = [[], ["e2e4"], ["e2e4", "e7e5"]]
    eng = _new_engine()
    try:
        for prefix in prefixes:
            legal = set(_js_legal(prefix))
            if not legal:
                continue
            mv = eng.get_best_move(moves=list(prefix), depth=2)
            assert mv, f"no bestmove for prefix {prefix}"
            core = mv[:4]
            legal_cores = {m[:4] for m in legal}
            assert core in legal_cores, (
                f"FS bestmove {mv} illegal in frontend rules after {prefix or 'startpos'}; "
                "possible Krishna/variant mismatch (see docs/FAIRY_STOCKFISH_BACKEND.md)"
            )
    finally:
        eng.quit()
