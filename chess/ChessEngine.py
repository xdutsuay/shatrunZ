# ChessEngine.py
"""
Minimal ChessEngine module for NineBlockMaster variant (9x9 board).
This is intentionally compact: it provides GameState with:
- board (2D list of strings, e.g. 'wp', 'bq', 'wkk' etc. or '--' for empty)
- moveFunctions dispatch mapping (normalized keys: 'P','N','B','R','Q','K','KK')
- helpers: in_bounds, normalize_piece_type, can_piece_capture
- move generators: getValidMoves, getKnightMoves, getKrishnaMoves, getPawnMoves (light)
This file is safe to extend; it's targeted to support initial unit tests and PR1 changes.
"""

from typing import List, Tuple

EMPTY = "--"


class GameState:
    def __init__(self):
        # Create a 9x9 board for this variant (rows x cols)
        self.board = self.create_initial_board()
        # white_to_move left in place for compatibility, but many helpers derive color from piece string
        self.white_to_move = True

        # moveFunctions keyed by normalized piece type (no color prefix)
        self.moveFunctions = {
            "P": self.getPawnMoves,
            "R": self.getRookMoves,
            "N": self.getKnightMoves,
            "B": self.getBishopMoves,
            "Q": self.getQueenMoves,
            "K": self.getKingMoves,
            "KK": self.getKrishnaMoves,  # custom piece
        }

    def create_initial_board(self) -> List[List[str]]:
        """
        Returns a 9x9 starting board for the variant.
        This is a simple example setup: main goal is to ensure elements exist for tests.
        Use piece strings where first char is color 'w' or 'b' and rest is type like 'p','n','kk', etc.
        We'll place:
         - bkk at top row center-ish
         - wkk at bottom row center-ish
         - a few knights and pawns for smoke tests
        """
        rows, cols = 9, 9
        board = [[EMPTY for _ in range(cols)] for _ in range(rows)]

        # top row (row 0) - black pieces placeholders
        board[0][0] = "br"  # black rook
        board[0][1] = "bn"  # black knight
        board[0][2] = "bb"  # black bishop
        board[0][3] = "bq"  # black queen
        board[0][4] = "bk"  # black king
        board[0][5] = "bkk"  # black krishna (custom)
        board[0][6] = "bb"
        board[0][7] = "bn"
        board[0][8] = "br"

        # pawns on row 1 (black)
        for c in range(cols):
            board[1][c] = "bp"

        # some empty middle rows
        # place a white knight and a few white pawns near bottom
        board[7][1] = "wn"  # white knight for knight tests
        board[7][3] = "wp"
        board[8][0] = "wr"
        board[8][1] = "wn"
        board[8][2] = "wb"
        board[8][3] = "wq"
        board[8][4] = "wk"
        board[8][5] = "wkk"  # white krishna (custom)
        board[8][6] = "wb"
        board[8][7] = "wn"
        board[8][8] = "wr"

        # white pawns (row 6)
        for c in range(cols):
            if board[6][c] == EMPTY:
                board[6][c] = "wp"

        return board

    # -----------------------------
    # Helper utilities (centralized)
    # -----------------------------
    def in_bounds(self, r: int, c: int) -> bool:
        """Return True when (r,c) is inside the current board dimensions."""
        if not hasattr(self, "board") or not self.board:
            return False
        return 0 <= r < len(self.board) and 0 <= c < len(self.board[0])

    def normalize_piece_type(self, piece_str: str) -> str:
        """
        Convert a stored board string like 'wp' or 'bkk' to the dispatch key.
        Strategy: strip color prefix (first char) and uppercase the remainder.
        Examples:
            'wp'  -> 'P'
            'wkk' -> 'KK'
        """
        if not piece_str or len(piece_str) < 2:
            return ""
        return piece_str[1:].upper()

    def can_piece_capture(self, attacker_piece_str: str, target_piece_str: str) -> bool:
        """
        Hook that determines if an attacker can capture a target.
        Default behavior: allow capturing when target exists and colors differ.
        We'll later extend this to support piece flags (e.g., krishna immunity).
        """
        if not target_piece_str or target_piece_str.strip() == "":
            return False
        if not attacker_piece_str or len(attacker_piece_str) < 1:
            return True
        # color is first char ('w' or 'b')
        # allow capture only if colors differ
        return attacker_piece_str[0] != target_piece_str[0]

    # -----------------------------
    # Top-level move generation
    # -----------------------------
    def getValidMoves(self) -> List[Tuple[Tuple[int, int], Tuple[int, int]]]:
        """
        Iterate the board; for each non-empty square, normalize the piece type
        and dispatch to the appropriate generator if available.
        Returns a list of moves represented as ((r1,c1),(r2,c2)).
        """
        moves = []
        rows = len(self.board)
        cols = len(self.board[0])
        for r in range(rows):
            for c in range(cols):
                piece = self.board[r][c]
                if piece and piece != EMPTY:
                    key = self.normalize_piece_type(piece)
                    move_fn = self.moveFunctions.get(key)
                    if move_fn:
                        move_fn(r, c, moves)
        return moves

    # -----------------------------
    # Move generators (minimal)
    # -----------------------------
    def getPawnMoves(self, r: int, c: int, moves: list):
        """
        Minimal pawn move generation: single forward if empty,
        two-step from starting rank (basic). This is conservative and
        avoids complex en-passant or promotion logic for now.
        """
        piece = self.board[r][c]
        if not piece or piece == EMPTY:
            return
        color = piece[0]
        direction = -1 if color == "w" else 1  # white pawns move up (toward row 0)
        start_row = 6 if color == "w" else 1
        # one-step
        nr, nc = r + direction, c
        if self.in_bounds(nr, nc) and self.board[nr][nc] == EMPTY:
            moves.append(((r, c), (nr, nc)))
            # two-step from start
            nr2 = r + 2 * direction
            if r == start_row and self.in_bounds(nr2, nc) and self.board[nr2][nc] == EMPTY:
                moves.append(((r, c), (nr2, nc)))
        # captures (very basic diagonals)
        for dc in (-1, 1):
            cr, cc = r + direction, c + dc
            if self.in_bounds(cr, cc):
                target = self.board[cr][cc]
                if target != EMPTY and self.can_piece_capture(piece, target):
                    moves.append(((r, c), (cr, cc)))

    def getKnightMoves(self, r: int, c: int, moves: list):
        """All 8 knight offsets with in_bounds() checks and can_piece_capture guard."""
        knightOffsets = (
            (-2, -1),
            (-2, 1),
            (-1, -2),
            (-1, 2),
            (1, -2),
            (1, 2),
            (2, -1),
            (2, 1),
        )
        piece = self.board[r][c]
        if not piece or piece == EMPTY:
            return
        for dr, dc in knightOffsets:
            end_row = r + dr
            end_col = c + dc
            if not self.in_bounds(end_row, end_col):
                continue
            end_piece = self.board[end_row][end_col]
            if end_piece == EMPTY:
                moves.append(((r, c), (end_row, end_col)))
            elif self.can_piece_capture(piece, end_piece):
                moves.append(((r, c), (end_row, end_col)))

    def getKrishnaMoves(self, r: int, c: int, moves: list):
        """
        Krishna acts as a sliding queen-like piece in this minimal implementation.
        Sliding continues until blocked; captures allowed when can_piece_capture returns True,
        and sliding stops after a capture or when encountering any piece.
        """
        piece = self.board[r][c]
        if not piece or piece == EMPTY:
            return
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
        for dr, dc in directions:
            step = 1
            while True:
                end_row = r + dr * step
                end_col = c + dc * step
                if not self.in_bounds(end_row, end_col):
                    break
                end_piece = self.board[end_row][end_col]
                if end_piece == EMPTY:
                    moves.append(((r, c), (end_row, end_col)))
                else:
                    # allow capture if permitted; then always stop sliding
                    if self.can_piece_capture(piece, end_piece):
                        moves.append(((r, c), (end_row, end_col)))
                    break
                step += 1

    # The following generators are stubs so the engine is functionally complete for tests.
    def getRookMoves(self, r: int, c: int, moves: list):
        # Very lightweight sliding rook (used only if needed by tests)
        piece = self.board[r][c]
        if not piece or piece == EMPTY:
            return
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for dr, dc in directions:
            step = 1
            while True:
                nr = r + dr * step
                nc = c + dc * step
                if not self.in_bounds(nr, nc):
                    break
                target = self.board[nr][nc]
                if target == EMPTY:
                    moves.append(((r, c), (nr, nc)))
                else:
                    if self.can_piece_capture(piece, target):
                        moves.append(((r, c), (nr, nc)))
                    break
                step += 1

    def getBishopMoves(self, r: int, c: int, moves: list):
        piece = self.board[r][c]
        if not piece or piece == EMPTY:
            return
        directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        for dr, dc in directions:
            step = 1
            while True:
                nr = r + dr * step
                nc = c + dc * step
                if not self.in_bounds(nr, nc):
                    break
                target = self.board[nr][nc]
                if target == EMPTY:
                    moves.append(((r, c), (nr, nc)))
                else:
                    if self.can_piece_capture(piece, target):
                        moves.append(((r, c), (nr, nc)))
                    break
                step += 1

    def getQueenMoves(self, r: int, c: int, moves: list):
        # Queen is rook + bishop
        self.getRookMoves(r, c, moves)
        self.getBishopMoves(r, c, moves)

    def getKingMoves(self, r: int, c: int, moves: list):
        piece = self.board[r][c]
        if not piece or piece == EMPTY:
            return
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                nr = r + dr
                nc = c + dc
                if not self.in_bounds(nr, nc):
                    continue
                target = self.board[nr][nc]
                if target == EMPTY:
                    moves.append(((r, c), (nr, nc)))
                elif self.can_piece_capture(piece, target):
                    moves.append(((r, c), (nr, nc)))
