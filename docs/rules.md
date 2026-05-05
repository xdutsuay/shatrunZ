## ShatrunZ rules (9x9 + Krishna)

This document is the **single source of truth** for the ShatrunZ variant rules, used to keep the **frontend rules** (`frontend/rules.js`) and the **C engine** (`engine/position.c`) consistent.

## Board + coordinates
- **Board size**: 9×9
- **Files**: `a`..`i`
- **Ranks**: `1`..`9`
- **Start position back rank** (White rank 1 / Black rank 9):
  - `R N B Q K B Z N R`
  - Krishna is `Z`/`z` and starts on **g-file**.

## Pieces
Standard chess pieces exist: pawn, knight, bishop, rook, queen, king.

### Krishna (`Z`/`z`)
Krishna is a special fairy piece with these properties:
- **Moves**: 1 square in any direction (king-like), **to empty squares only**.
- **Does not capture**: Krishna can never move onto an occupied square.
- **Cannot be captured**: no piece may capture Krishna (moves that would capture it are illegal).
- **Does not give check**: Krishna is not considered an attacking piece for check detection.
- **Blocks lines**: Krishna occupies a square and therefore blocks sliding attacks/moves like any other piece.

## Captures
- Captures follow standard chess rules **except**:
  - Capturing Krishna is illegal.
  - Krishna does not capture at all.

## Check + checkmate
- Check is defined only by attacks from **standard pieces** (pawn/knight/bishop/rook/queen/king).
- A move is illegal if it leaves your king in check.

## Castling
Castling is supported with standard constraints adapted to 9×9:
- **King start square**: `e1` (White) / `e9` (Black)
- **Kingside rook**: `i1` / `i9`, king ends on `g1` / `g9`, rook ends on `f1` / `f9`
- **Queenside rook**: `a1` / `a9`, king ends on `c1` / `c9`, rook ends on `d1` / `d9`
- Constraints:
  - King is not currently in check.
  - Squares between king and rook are empty.
  - Squares the king passes through and lands on are not attacked.
  - Castling rights are lost once the king moves, or the relevant rook moves/is captured.

Note: because Krishna starts on `g`-file, **kingside castling is only possible after Krishna vacates g1/g9** (since the king must land on g1/g9 and that square must be empty).

## Promotion
- Pawns promote on the last rank (`9` for White, `1` for Black).
- Promotions allowed: **Q, R, B, N**.

## Draw rules
Current implementation does not fully enforce standard draw rules (e.g. 50-move rule, repetition detection) at the engine level.
Those can be added later; when implemented, update this document first.

