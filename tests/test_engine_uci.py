from __future__ import annotations

import subprocess

from tests.engine_paths import engine_binary


def test_engine_uci_smoke():
    engine_path = engine_binary()
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


def test_engine_go_movetime_and_eval():
    engine_path = engine_binary()
    assert engine_path.exists()

    p = subprocess.run(
        [str(engine_path)],
        input=(
            "uci\nisready\nposition startpos\n"
            "go movetime 80\n"
            "position startpos\neval\n"
            "quit\n"
        ),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=15,
        check=True,
    )
    out = p.stdout
    assert "bestmove" in out
    assert "info score cp" in out


def test_engine_position_fen():
    engine_path = engine_binary()
    assert engine_path.exists()
    start_fen = "rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - - 0 1"

    p = subprocess.run(
        [str(engine_path)],
        input=f"uci\nisready\nposition fen {start_fen}\nlegal\nquit\n",
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=10,
        check=True,
    )
    out = p.stdout
    assert "legalmoves" in out
    assert "a2a3" in out

