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
- 2026-07-13: M1 (rules/game, position-only variant). Ported
  `piece.rs`/`board.rs`/`moves.rs`/`rules.rs`/`game.rs` to `shatrunz-core` —
  move generation, check/checkmate/stalemate detection, castling
  (position-only, matching JS — the C engine's rights-mask variant is
  deferred to M4), auto-queen promotion (C's underpromotion variant also
  deferred to M4), 5-fold repetition, 240-ply/±300 adjudication,
  `position_key`. **P1 perft gate is green**: `tools/js/perft.mjs` dumps
  startpos perft(1-3) + 20 seeded random-opening positions (mulberry32,
  depth 2) from the JS oracle into
  `crates/shatrunz-core/tests/fixtures/perft_fixture.json`;
  `tests/perft.rs` replays them through the Rust port and asserts exact
  node-count + position_key equality — all green
  (`cargo test -p shatrunz-core`). `tests/game_status.rs` additionally
  cross-checks `position_key`/status-string format directly against
  `node -e "new Game()..."` output, the king-absent-in-check quirk, and a
  full castling execute/undo round trip, and two synthetic positions
  (ladder-mate CHECKMATE, corner Stalemate) built by hand-placing pieces and
  cross-checked against `node -e "new Game()..."` output before being ported
  — both match. **Not yet parity-tested**: the `"Draw by Repetition"` and
  `"Adjudicated: ... (material)"` status strings (not exercised by any
  perft-depth-2/3 game or hand-built position yet), and move-generation
  *order* (perft only checks counts) — both deferred to the P3/P4 gates in
  M2. Next: M2 (both evals + both searches + clock_budget).

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
| Board setup: 9×9, back rank `R N B Q K B Z N R`, pawns rows 1/7 | `frontend/game.js:6-22`, `frontend/constants.js:1-4` | `shatrunz-core::board::Board::setup` | ✅ | ✅ (perft) | ▢ |
| Krishna (`z`, weight 1200): step-only to empty squares, never captures, never captured, gives no check, blocks sliding rays | `frontend/rules.js:59-77` (krishna branch + generic capture filter), `rules.js:170,219` (blocks rays) | `shatrunz-core::rules` (in `get_legal_moves`/`is_square_attacked`) | ✅ | ✅ (perft, transitively) | ▢ |
| Pawn moves: single/double push from start rank, diagonal capture only, no en passant | `frontend/rules.js:29-43` | `shatrunz-core::rules::get_legal_moves` | ✅ | ✅ (perft) | ▢ |
| Promotion at row 0/8: JS auto-queens | `frontend/rules.js` (destination-row check), `frontend/game.js:61-64` | `shatrunz-core::game::execute_move` | ✅ (JS variant) | ✅ (perft) | ▢ |
| Promotion: C engine underpromotion variant | `engine/position.c` | `PromotionMode` flag | ▢ (deferred to M4) | ▢ | ▢ |
| Castling: king c4→c6 (rook 8→5) / c4→c2 (rook 0→3), path-empty + not-attacked; JS is position-only | `frontend/rules.js:91-131` | `shatrunz-core::rules::get_legal_moves` | ✅ (JS position-only variant) | ✅ (perft + `tests/game_status.rs` execute/undo round trip) | ▢ |
| Castling: C engine 4-bit rights-mask variant | `engine/position.c` | `CastlingMode::Rights` | ▢ (deferred to M4) | ▢ | ▢ |
| `isKingInCheck` returns true if king is absent from the board | `frontend/rules.js:206` | `shatrunz-core::rules::is_king_in_check` | ✅ | ✅ (`tests/game_status.rs`) | ▢ |
| Move generation order (affects search tie-breaking) — must replicate JS/C iteration order exactly | `frontend/rules.js` (per-piece loops) | `shatrunz-core::rules::get_legal_moves` | ✅ (order copied 1:1) | ▢ (perft only checks counts; order parity deferred to P3 search-tie-break test in M2) | ▢ |

## Game state

| Item | Source | Rust location | ported | parity-verified | old deleted |
|---|---|---|---|---|---|
| **FROZEN** Position key: `"{turn}\|"` + `"{color}{type}{r}{c}"` per occupied square, row-major — SQLite tablebase key via `/api/tablebase?key=` | `frontend/game.js:25-33` (`getHash`) | `shatrunz-core::game::Game::position_key` | ✅ | ✅ (`tests/game_status.rs` cross-checked against `node -e` output; `tests/perft.rs` checks it after replaying 20 seeded openings) | ▢ |
| 5-fold repetition → draw | `frontend/game.js:205-208` | `shatrunz-core::game::Game::check_status` | ✅ | ▢ (not yet exercised by a test — perft games are too short to repeat 5x) | ▢ |
| Adjudication after 240 half-moves if `\|material\| >= 300` | `frontend/game.js:211-217` | `shatrunz-core::game::Game::check_status` | ✅ | ▢ (not yet exercised by a test) | ▢ |
| **FROZEN** status strings: `"CHECKMATE! White Wins"` / `"...Black Wins"`, `"Draw by Repetition"`, `"Adjudicated: {color} wins (material)"`, `" (CHECK)"` suffix, `"White's Turn"`/`"Black's Turn"`, `"Stalemate"` — UI/tests match on these | `frontend/game.js:208,217,224,226,230-231` | `shatrunz-core::game::Status` | ✅ (all branches implemented) | partial — ✅ `"White's Turn"`, `"CHECKMATE! White Wins"`, `"Stalemate"` (`tests/game_status.rs`, synthetic positions cross-checked against the JS oracle); ▢ `"Draw by Repetition"`, `"Adjudicated: ..."`, `" (CHECK)"` suffix not yet exercised | ▢ |

## Evaluation

| Item | Source | Rust location | ported | parity-verified | old deleted |
|---|---|---|---|---|---|
| Phase detection (opening/middlegame/endgame from non-Krishna piece count) | `frontend/shared/game_phase.js` (47 lines) | `shatrunz-core::phase` | ✅ | ✅ (transitively, via `eval_hce_parity.rs` — phase selects HCE's king PST table, though see the PST bug row below for why that barely matters in practice) | ▢ |
| JS persona eval (material/positional/aggressive PSTs, mobility ×3, pawn structure, capture pressure, tempo, `Math.round`) | `frontend/shared/eval_core.js` (246 lines) | `shatrunz-core::eval::hce` | ✅ | ✅ (`tests/eval_hce_parity.rs`: 21 positions × 3 personas × {white, forSearch}, all exact) | ▢ |
| **FROZEN BUG** `pstForPiece`'s piece-square term is a no-op for ~all real positions (2D PST tables indexed with a flat formula → `undefined ?? 0`); the `idx<9` corner corrupts JS's `score` to a string/NaN instead of a clean number | `frontend/shared/eval_core.js` (`pstForPiece`, PST_PAWN etc. at lines 12-70) | `shatrunz-core::eval::hce::pst_for_piece` — returns 0 for Pawn/Knight/King/Krishna always; Bishop/Rook/Queen's center term is unaffected and works correctly | ✅ (dominant case reproduced) | ✅ (perft-adjacent positions in `tests/eval_hce_parity.rs` all hit the `idx>=9` no-op path and match) | — (not a deletion candidate; it's the JS behavior itself) |
| C engine eval (material + PST, side-to-move) — genuinely uses flat `[81]` C arrays, no equivalent bug | `engine/evaluate.c` (116 lines) | `shatrunz-core::eval::engine` | ✅ | ✅ (`tests/eval_engine_parity.rs`: 21 positions driven through the built `engine/shatrunz_engine` UCI binary, exact `cp` match) | ▢ |
| C/JS PST table divergences found while transcribing (verified via `python3 -c` parsing the raw C array literals, not hand-copied): `PST_KING` row 8 differs (C: `20,30,10,0,0,0,10,30,20`; JS: `20,40,20,0,0,0,20,40,20`); `PST_KRISHNA` center bonus sits on row 4 in C vs row 3 in JS | `engine/evaluate.c:68-75,55-65` vs `frontend/shared/eval_core.js` `PST_KING_MID`/`PST_KRISHNA` | separate tables in `eval::engine` vs `eval::hce`, deliberately not unified | ✅ | ✅ (both parity tests pass independently with their own tables) | — |

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
