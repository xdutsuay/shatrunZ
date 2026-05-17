import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from engine.engine_wrapper import ShatrunZEngine


def _read_until(engine: ShatrunZEngine, pattern: str, limit: int = 400):
    rgx = re.compile(pattern)
    seen = []
    for _ in range(limit):
        line = engine.get_response(timeout=2)
        if not line:
            continue
        seen.append(line)
        if rgx.search(line):
            return seen
    raise AssertionError(f"Did not see pattern {pattern!r} in engine output. Last lines: {seen[-20:]}")


def _board_after_d(engine: ShatrunZEngine) -> list[str]:
    engine.send("d")
    # Board print starts with the top border line.
    lines = _read_until(engine, r"^Castling:")
    return lines


def _piece_at_d_output(board_lines: list[str], rank: int, file_char: str) -> str:
    """
    Parse the engine 'd' board output.

    Each rank line looks like: `9| r | n | ... |`
    We extract the character in the file column.
    """
    file_map = {c: i for i, c in enumerate("abcdefghi")}
    col = file_map[file_char]
    # Find the line starting with f"{rank}|"
    row = next((ln for ln in board_lines if ln.startswith(f"{rank}|")), None)
    assert row is not None, f"Rank line {rank}| not found in d-output"
    # Split on '|' and take the 9 cell segments.
    parts = row.split("|")
    # Example: ["1", " R ", " N ", ..., " . ", ""] => 11 parts (rank + 9 + trailing)
    cells = [p.strip() for p in parts[1:10]]
    assert len(cells) == 9, f"Expected 9 cells for rank {rank}, got {len(cells)}: {row}"
    ch = cells[col]
    assert len(ch) == 1, f"Expected single-char cell at {file_char}{rank}, got {ch!r}"
    return ch


def test_white_kingside_castling_moves_king_and_rook():
    engine_path = str(Path(__file__).parent.parent / "engine" / "shatrunz_engine")
    eng = ShatrunZEngine(engine_path)
    try:
        eng.new_game()

        # Prepare a position where e1g1 castling should be legal:
        # clear f1 (bishop) and g1 (krishna) and keep rook at i1.
        moves = [
            "e2e4",
            "e8e6",
            "f1e2",
            "d8d6",
            "g2g4",
            "c8c6",
            "g1g2",
            "b8b6",
            "e1g1",
        ]

        eng.send(f"position startpos moves {' '.join(moves)}")
        board = _board_after_d(eng)

        # After white castles kingside: King should be on g1, rook on f1.
        # Engine uses uppercase for White pieces.
        king_g1 = _piece_at_d_output(board, rank=1, file_char="g")
        rook_f1 = _piece_at_d_output(board, rank=1, file_char="f")
        assert king_g1 == "K"
        assert rook_f1 == "R"
    finally:
        eng.quit()
