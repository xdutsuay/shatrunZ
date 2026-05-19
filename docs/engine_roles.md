# Engine roles: JS vs C

## Design intent

| Layer | Role |
|-------|------|
| **JavaScript** (`frontend/rules.js`, `frontend/game.js`) | Source of truth for game rules, human input, replay, and AIvAI legality |
| **C engine** (`engine/shatrunz_engine`) | UCI-compliant fast search for PvAI (optional) and offline self-play |
| **Backend** (`/api/engine-move`) | Proxies UCI to C or external Fairy-Stockfish |

C re-implements move generation for search speed. Drift is guarded by `tests/test_engine_parity.py` (JS legal set must equal C `legal` command output).

If parity fails, **fix the C generator** unless the JS rule change was intentional and documented in `docs/rules.md`.

**Known limitation:** Deep positions (12+ plies) may diverge when C silently skips a move during `position ... moves` replay that JS applied. Shallow parity walks (`tests/test_engine_parity.py`, ≤12 plies) must pass; full-depth parity is tracked as engine debt.

## Commands

- `position startpos moves ...` — set position
- `go depth N` — search
- `legal` — print `legalmoves uci1 uci2 ...` (ShatrunZ extension)

## ML policy net

| Path | Role |
|------|------|
| Training labels | C engine self-play (`tools/selfplay.py`, depth 3–4) |
| Legality mask | JS `Rules` (via `ml/dataset.py` Node replay) |
| **JS AI** | `POST /api/ml/policy-hint` adds move bonuses in `AIPlayer.getBestMove` when Settings toggle on |
| **C PvAI** | Uses C `bestmove` directly; policy net does not override C moves in v1 |

Export: `ml/export_onnx.py` → `models/policy_v1.onnx` (optional browser use later).

## Offline check

```bash
make -C engine
pytest tests/test_engine_parity.py -q
node tools/js/legal_moves.mjs d2d3 d8d7
```
