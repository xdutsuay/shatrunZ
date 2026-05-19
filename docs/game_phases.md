# Game phases (opening / middlegame / endgame)

ShatrunZ uses **non-Krishna piece count** on the board to label phase:

| Phase | Pieces (non-Krishna) | AI behavior (v1) |
|-------|----------------------|------------------|
| Opening | ≥ 26 | Prefer `brain.memory` moves with enough visits (opening-book bonus) |
| Middlegame | 8–25 | Normal search + help signals |
| Endgame | ≤ 7 | +1 search depth (tablebase hook placeholder) |

## Bell-curve intuition

Plot **x** = non-Krishna pieces, **y** = legal move count for the side to move. You typically see:

- **Opening / endgame**: fewer “good” distinct plans (book lines or reduced material).
- **Middlegame**: highest branching factor.

Krishna is excluded from the piece count because it does not capture or get captured; it still blocks lines and affects tactics.

Implementation: [`frontend/shared/game_phase.js`](../frontend/shared/game_phase.js).
