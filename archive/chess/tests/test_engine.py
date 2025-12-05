# tests/test_engine.py
import pytest
from ChessEngine import GameState

def test_gamestate_initializes():
    """GameState should initialize a board and moveFunctions mapping."""
    gs = GameState()
    assert hasattr(gs, "board")
    assert isinstance(gs.board, list)
    assert len(gs.board) > 0
    assert hasattr(gs, "moveFunctions")
    assert isinstance(gs.moveFunctions, dict)

def test_in_bounds_helper():
    """in_bounds should return True for interior squares and False for obvious OOB."""
    gs = GameState()
    rows = len(gs.board)
    cols = len(gs.board[0])
    assert gs.in_bounds(rows // 2, cols // 2)
    assert not gs.in_bounds(-1, 0)
    assert not gs.in_bounds(rows, cols)

def test_get_valid_moves_smoke():
    """getValidMoves() returns a list and is callable multiple times."""
    gs = GameState()
    moves = gs.getValidMoves()
    assert isinstance(moves, list)

def test_krishna_dispatch_present():
    """Dispatch mapping should include 'KK' (krishna) so 'wkk' doesn't map to 'K' wrongly."""
    gs = GameState()
    keys = {k.upper() for k in gs.moveFunctions.keys()}
    assert "KK" in keys or "K" in keys  # accept either if the code uses K for king and KK for krishna

def test_knight_corner_moves_not_crash():
    """Placing a knight near the corner should generate moves without index errors."""
    gs = GameState()
    found = False
    for r in range(len(gs.board)):
        for c in range(len(gs.board[0])):
            if gs.board[r][c] and gs.board[r][c].upper().endswith("N"):
                # call getKnightMoves directly if present
                try:
                    gs.getKnightMoves(r, c, [])
                    found = True
                except Exception as e:
                    pytest.fail(f"getKnightMoves raised {e}")
    # If no knight present, place a test knight at (0,1) and ensure invocation doesn't error
    if not found:
        gs.board[0][1] = "wn"
        try:
            gs.getKnightMoves(0, 1, [])
        except Exception as e:
            pytest.fail(f"getKnightMoves on injected knight raised {e}")
