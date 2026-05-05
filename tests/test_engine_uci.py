from __future__ import annotations

import subprocess
from pathlib import Path


def test_engine_uci_smoke():
    engine_path = Path(__file__).parent.parent / "engine" / "shatrunz_engine"
    assert engine_path.exists()

    p = subprocess.run(
        [str(engine_path)],
        input="uci\nisready\nposition startpos\ngo depth 1\nquit\n",
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=10,
        check=True,
    )

    out = p.stdout
    assert "uciok" in out
    assert "readyok" in out
    assert "bestmove" in out

