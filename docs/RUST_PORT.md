# Rust Port Checklist

Source of truth for the port described in `docs/plans/PLAN_03_rust_port.md`.
Every row tracks two *independent* facts:

- **ported** — a Rust implementation exists.
- **parity-verified** — a deterministic test proves it matches the JS/C/Python
  original (see `P1`–`P7` gates in the plan).

**`ported` never authorizes deleting the original.** Only `parity-verified`
does, and only in the M7 deletion milestone. Items marked **FROZEN** are
external contracts (DB keys, UI/test-matched strings) — the port must
reproduce them byte-for-byte, not "improve" them.

Legend: ✅ done · ▢ not started · — n/a

## Session log

- 2026-07-13: M0 scaffold. Workspace (`Cargo.toml`, `rust-toolchain.toml` pinned
  to 1.94.1 + `wasm32-unknown-unknown`), 5 crates created and building
  (`cargo build --workspace` green). `wasm-pack build crates/shatrunz-wasm
  --target web` validated end to end (installs `wasm-bindgen-cli` on first
  run, ~1m40s cold). Root `Makefile` added (`just` isn't preinstalled here).
  This file created. Nothing ported yet — M1 (core rules/game) is next.

## Toolchain setup (fresh container, one command each)

```bash
make setup   # rustup target add wasm32-unknown-unknown; cargo install wasm-pack --locked
make build   # cargo build --workspace
make wasm    # wasm-pack build crates/shatrunz-wasm --target web/nodejs -d frontend/pkg[-node]
```

(`just` is not preinstalled in this environment, so the root `Makefile` is the
build entry point rather than a justfile — see `Makefile` for all recipes.)
No proxy issues observed fetching crates.io or installing wasm-pack in this
environment (verified 2026-07-13).

## Rules / movement

| Item | Source | Rust location | ported | parity-verified | old deleted |
|---|---|---|---|---|---|
| Board setup: 9×9, back rank `R N B Q K B Z N R`, pawns rows 1/7 | `frontend/game.js:6-22`, `frontend/constants.js:1-4` | `shatrunz-core::board` (M1) | ▢ | ▢ | ▢ |
| Krishna (`z`, weight 1200): step-only to empty squares, never captures, never captured, gives no check, blocks sliding rays | `frontend/rules.js:59` (knight/king/krishna branch), filtered out of capture targets throughout `rules.js` | `shatrunz-core::piece` / `moves` (M1) | ▢ | ▢ | ▢ |
| Pawn moves: single/double push from start rank, diagonal capture only, no en passant | `frontend/rules.js:29-43` | `shatrunz-core::moves` (M1) | ▢ | ▢ | ▢ |
| Promotion at row 0/8: JS auto-queens; C engine generates underpromotions | `frontend/rules.js` (promotion branch, TBD line on port), `engine/position.c` | `CastlingMode`-style `PromotionMode::AutoQueen \| Underpromotions` flag (M1) | ▢ | ▢ | ▢ |
| Castling: king c4→c6 (rook 8→5) / c4→c2 (rook 0→3), path-empty + not-attacked; JS is position-only, C tracks a 4-bit rights mask | `frontend/rules.js:91-126` | `shatrunz-core::rules::CastlingMode::PositionOnly \| Rights` (M1) | ▢ | ▢ | ▢ |
| `isKingInCheck` returns true if king is absent from the board | `frontend/rules.js` (king-search helper) | `shatrunz-core::rules` (M1) | ▢ | ▢ | ▢ |
| Move generation order (affects search tie-breaking) — must replicate JS/C iteration order exactly | `frontend/rules.js` (per-piece loops), `engine/position.c` | `shatrunz-core::moves` (M1) | ▢ | ▢ | ▢ |

## Game state

| Item | Source | Rust location | ported | parity-verified | old deleted |
|---|---|---|---|---|---|
| **FROZEN** Position key: `"{turn}\|"` + `"{color}{type}{r}{c}"` per occupied square, row-major — SQLite tablebase key via `/api/tablebase?key=` | `frontend/game.js:25-33` (`getHash`) | `shatrunz-core::game::position_key` (M1) | ▢ | ▢ | ▢ |
| 5-fold repetition → draw | `frontend/game.js:205-208` | `shatrunz-core::game` (M1) | ▢ | ▢ | ▢ |
| Adjudication after 240 half-moves if `\|material\| >= 300` | `frontend/game.js:211-217` | `shatrunz-core::game` (M1) | ▢ | ▢ | ▢ |
| **FROZEN** status strings: `"CHECKMATE! White Wins"` / `"...Black Wins"`, `"Draw by Repetition"`, `"Adjudicated: {color} wins (material)"`, `" (CHECK)"` suffix — UI/tests match on these | `frontend/game.js:208,217,224,231` | `shatrunz-core::game::Status` (M1) | ▢ | ▢ | ▢ |

## Evaluation

| Item | Source | Rust location | ported | parity-verified | old deleted |
|---|---|---|---|---|---|
| JS persona eval (material/positional/aggressive PSTs, mobility ×3, pawn structure, capture pressure, tempo, `Math.round`) | `frontend/shared/eval_core.js` (246 lines) | `shatrunz-core::eval::hce` (M2) — f64, identical op order, `js_round = floor(x+0.5)` | ▢ | ▢ | ▢ |
| C engine eval (material + PST, side-to-move) | `engine/evaluate.c` (116 lines) | `shatrunz-core::eval::engine` (M2) | ▢ | ▢ | ▢ |

## Search

| Item | Source | Rust location | ported | parity-verified | old deleted |
|---|---|---|---|---|---|
| JS persona search: unordered negamax + captures-only quiescence (qDepth 4), deadline, iterative deepening capped at depth 8 under budget, root-only bonuses, `onSearchUpdate` info events, `lastDecision` | `frontend/ai.js` (340 lines) | `shatrunz-core::search::persona` (M2) | ▢ | ▢ | ▢ |
| C engine search: capture-first ordering, quiescence with checks, mate scores `-100000+ply`, `search_timed` per-depth re-search at 0.9 budget | `engine/search.c` (212 lines) | `shatrunz-core::search::engine` (M2) | ▢ | ▢ | ▢ |
| Clock budget calc | `frontend/shared/clock_budget.js` (46 lines) | `shatrunz-core::clock_budget` (M2) | ▢ | ▢ | ▢ |

## UCI commands (`shatrunz-engine`, replaces `engine/uci.c`)

| Command | Source | ported | parity-verified | old deleted |
|---|---|---|---|---|
| `uci` / `isready` / `ucinewgame` | `engine/uci.c` (310 lines) | ▢ | ▢ | ▢ |
| `position startpos [moves]` | `engine/uci.c` | ▢ | ▢ | ▢ |
| `position fen` (new — wrapper already sends it, C engine doesn't handle it yet) | — | ▢ | ▢ | ▢ |
| `go [depth\|randomness\|movetime\|clocks]` | `engine/uci.c` | ▢ | ▢ | ▢ |
| `d` (debug print), custom `legal`, custom `eval` | `engine/uci.c` | ▢ | ▢ | ▢ |
| `bestmove 0000` (null-move sentinel) | `engine/uci.c` | ▢ | ▢ | ▢ |
| `quit` | `engine/uci.c` | ▢ | ▢ | ▢ |
| **FROZEN** square codec: file a–i, rank = 9−row | `engine/uci.c` | ▢ | ▢ | ▢ |

## Server routes (`shatrunz-server`, replaces `backend/server.py`)

| Route | Source | ported | parity-verified | old deleted |
|---|---|---|---|---|
| `GET /`, `/pvp`, `/pvai`, `/aivai`, `/admin` (pages) | `backend/server.py:92-104` | ▢ | ▢ | ▢ |
| `GET /models/<path>` (static) | `backend/server.py:108-109` | ▢ | ▢ | ▢ |
| `POST /api/ml/policy-hint` | `backend/server.py:113-124` | ▢ | ▢ | ▢ |
| `GET /api/ml/metrics` | `backend/server.py:126-136` | ▢ | ▢ | ▢ |
| `POST /api/save-game` | `backend/server.py:138-191` | ▢ | ▢ | ▢ |
| `POST /api/save-brain` | `backend/server.py:193-212` | ▢ | ▢ | ▢ |
| `GET /api/load-brain/<name>` | `backend/server.py:213-223` | ▢ | ▢ | ▢ |
| `GET /api/games` | `backend/server.py:225-235` | ▢ | ▢ | ▢ |
| `POST /api/analyze-game` | `backend/server.py:236-252` | ▢ | ▢ | ▢ |
| `POST /api/engine-move` | `backend/server.py:253-295` | ▢ | ▢ | ▢ |
| `GET /api/health` | `backend/server.py:296-307` | ▢ | ▢ | ▢ |
| `GET /api/stats/summary` (ports `backend/stats.py`) | `backend/server.py:308-314` | ▢ | ▢ | ▢ |
| `POST /api/engine-eval` | `backend/server.py:315-345` | ▢ | ▢ | ▢ |
| `POST /api/engine-search` (NDJSON stream) | `backend/server.py:346-382` | ▢ | ▢ | ▢ |
| `POST /api/inspector/analyze` | `backend/server.py:383-404` | ▢ | ▢ | ▢ |
| `POST /api/inspector/bulk` | `backend/server.py:405-414` | ▢ | ▢ | ▢ |
| `GET /api/training-runs` | `backend/server.py:415-436` | ▢ | ▢ | ▢ |
| `GET /api/db/stats` | `backend/server.py:437-448` | ▢ | ▢ | ▢ |
| **FROZEN** `GET /api/tablebase?key=` (position_key contract) | `backend/server.py:449-464` | ▢ | ▢ | ▢ |
| `POST /api/ml/train`, `GET /api/ml/train/status`, `GET /api/ml/train/stream` (SSE; ports `backend/training_jobs.py`) | `backend/server.py:465-503` | ▢ | ▢ | ▢ |
| `GET /<path>` (static fallback) | `backend/server.py:504-505` | ▢ | ▢ | ▢ |

## DB schema

| Item | Source | ported | parity-verified | old deleted |
|---|---|---|---|---|
| SQLite schema + dual-write on save-game | `backend/db.py` | ▢ | ▢ | ▢ |

## ShatrunZ MCP (new capability, not a port — see plan's M3)

| Tool | ported | parity-verified (smoke) |
|---|---|---|
| `new_game` | ▢ | ▢ |
| `get_state` | ▢ | ▢ |
| `legal_moves` | ▢ | ▢ |
| `make_move` | ▢ | ▢ |
| `engine_move` | ▢ | ▢ |
| `evaluate` | ▢ | ▢ |
| `analyze` | ▢ | ▢ |
| `perft` | ▢ | ▢ |
| `self_play` | ▢ | ▢ |
| `tournament` | ▢ | ▢ |
| `set_persona_weights` / `reset_weights` | ▢ | ▢ |
| `import_pgn` / `export_pgn` | ▢ | ▢ |

Note: `rmcp` fetchability from crates.io not yet checked in this environment
— check at M3 start; fallback is a hand-rolled stdio JSON-RPC loop.

## Frontend module disposition (M5)

| Module | Disposition | Notes |
|---|---|---|
| `frontend/rules.js`, `game.js`, `shared/eval_core.js`, `uci.js`, `shared/game_phase.js`, `shared/pgn_parse.js`, `shared/clock_budget.js`, `shared/opening_book.js`, `shared/move_explainer.js`, `shared/replay.js`, `shared/replay_step.js`, `ai.js` | → thin adapter over `frontend/pkg/` (wasm-bindgen output) | `game.js` adapter must mirror the board into a JS 81-cell snapshot after each mutation (`ui.js` reads `game.board[r][c]` directly) |
| `frontend/brain.js` | stays JS | localStorage; feeds `rootBonuses`/`positionValue` numbers into search |
| `frontend/shared/settings_store.js`, `policy_net.js` (fetch), `api.js`, `ui.js`, `shared/board_view.js`, `main.js`, `admin_main.js`, `modes/*`, `shared/clock_controller.js` (timers), `shared/help_signal.js`, `shared/engine_move.js`, `shared/engine_pv_panel.js`, `shared/persona_chart.js`/`persona.js` (labels/chart) | stays JS | no core logic |
| new: `frontend/workers/ai_worker.js` | new file | runs `search_best_move` in a module Web Worker, streams `onSearchUpdate`/info events via `postMessage`; main-thread direct call kept as fallback |

## Build / deploy artifacts

| Item | ported | parity-verified | old deleted |
|---|---|---|---|
| `start.sh` runs `shatrunz_server` binary instead of `python start.py` | ▢ | ▢ | ▢ |
| `Dockerfile`: multi-stage `rust-build` → `python:3.12-slim` runtime (PyTorch sidecars stay Python) | ▢ | ▢ | ▢ |
| `package.json` test script rewritten: surviving boundary/DOM `tests-js` + `cargo test` + `pytest` | ▢ | ▢ | ▢ |

## Test replacements

| Old | New | ported | parity-verified |
|---|---|---|---|
| `tools/js/legal_moves.mjs`, self-play scripts | `tools/js/perft.mjs` fixtures + `cargo test` (P1) | ▢ | ▢ |
| JS eval dumps vs C `eval` | P2 integer-equality test | ▢ | ▢ |
| deterministic JS/C bestmove+score | P3 search parity test | ▢ | ▢ |
| `fuzz_rules_invariants`, `invariants/game_invariants.js` | Rust port with mulberry32 (P4) | ▢ | ▢ |
| `tests/` pytest suite, `tests/engine_mate_in_1.sh` | run unmodified against `shatrunz_engine` binary (P5) | ▢ | ▢ |
| `tests-js` pure-module suites | run unmodified through adapters (P6) | ▢ | ▢ |
| `tests/test_backend_contracts.py`, `test_api_health.py`, `test_stats_summary.py` | HTTP tests against spawned axum server (P7) | ▢ | ▢ |

## Deferred (explicitly out of scope for the port itself)

- Zobrist hashing (position_key stays the string format above — FROZEN)
- ort/ONNX in-process inference (policy-hint stays a Python stdio sidecar)
- wasm threads
- Engine strength improvements / unifying the two `CastlingMode`s and the
  auto-queen-vs-underpromotion split — deliberately preserved bug-for-bug
  during the port
