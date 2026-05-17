# Position API (engine move)

The backend exposes `POST /api/engine-move` with:

| Field | Type | Role |
|-------|------|------|
| `moves` | `string[]` or space-delimited string | **Preferred.** UCI moves from ShatrunZ startpos (e.g. `e2e4`, `e8e6`). Engine applies `position startpos moves ...`. |
| `fen` | string | Optional fallback (not required when `moves` is complete). |
| `depth` | int | Search depth (default 5). |
| `randomness` | int | 0–100 noise (C engine). |

The web UI keeps `uciMoveHistory` in sync with the board via `executeAndRecordMove()` in `frontend/ui.js` and sends that list on every C-engine request.

**Acceptance:** After 5+ human moves, enabling the engine returns a move legal in the **current** position, not the initial position.
