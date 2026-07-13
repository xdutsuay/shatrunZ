# ShatrunZ Rust Port

## Context

ShatrunZ is a 9×9 chess variant (standard pieces + the uncapturable "Krishna" piece) whose logic currently exists three times: vanilla-JS game core in the browser, a C UCI engine, and a Python Flask backend. Per the user's decisions: port **everything portable** to Rust on branch `claude/rust-port-bl0o62` (already checked out) — browser game core compiled to **WASM** (Rust+WASM runs in the browser), C engine replaced by a **Rust UCI binary**, Flask backend replaced by a **Rust (axum) server**. PyTorch training stays Python (subprocess sidecars). A **feature checklist** (`docs/RUST_PORT.md`) is the source of truth so nothing is missed. **Original JS logic / C engine / Flask are deleted** once parity is verified — during development they serve as parity oracles.

## Toolchain (verified in this environment)

- cargo/rustc 1.94.1 work; crates.io fetches + builds succeed through the proxy.
- `wasm32-unknown-unknown` target installed (I added it) and compiles.
- wasm-pack/wasm-bindgen-cli not installed → `cargo install wasm-pack --locked` in M0 (fallback: `wasm-bindgen-cli` driven manually).

## Workspace layout

Root `Cargo.toml` workspace, `resolver = "2"`:

```
crates/
  shatrunz-core/     # pure logic, zero I/O: piece.rs, board.rs (81-cell), moves.rs (+UCI codec),
                     # rules.rs, game.rs, phase.rs, eval/{hce,engine}.rs, search/{persona,engine}.rs,
                     # clock_budget.rs, book.rs, pgn.rs, replay.rs, explain.rs, fen.rs (new)
  shatrunz-wasm/     # cdylib; wasm-bindgen + serde-wasm-bindgen thin bindings
  shatrunz-engine/   # bin `shatrunz_engine`: UCI loop over core (replaces engine/*.c)
  shatrunz-server/   # bin: axum + tokio + tower-http + rusqlite(bundled) (replaces Flask)
  shatrunz-mcp/      # bin `shatrunz-mcp`: MCP (stdio JSON-RPC) over core — agent play/tune loop
```

## Behaviors the port MUST preserve (checklist anchors)

- **Setup**: 9×9; row 0 = Black back rank `R N B Q K B Z N R` (King c4, Krishna c6); pawns rows 1/7; White row 8.
- **Krishna (z, weight 1200)**: moves 1 step to *empty* squares only, never captures, can never be captured (all generators filter z targets), gives no check, **blocks sliding rays**.
- **Pawns**: double push from rank 7(w)/1(b); no en passant; promotion row 0/8 — JS auto-queens; C engine generates underpromotions → core supports both behind a flag.
- **Castling**: king c4→c6 (rook 8→5) / c4→c2 (rook 0→3) with path-empty + not-attacked checks. JS is position-only (no rights tracking); C tracks a 4-bit rights mask → `CastlingMode::PositionOnly | Rights` in core.
- **Position key**: byte-identical port of `game.js getHash()` — `"{turn}|"` + `"{color}{type}{r}{c}"` per occupied square, row-major. It's an **external contract** (SQLite tablebase key via `/api/tablebase?key=`).
- **Rules quirks kept**: `isKingInCheck` returns true if king absent; exact JS move-generation *order* replicated (affects search tie-breaking).
- **Game state**: 5-fold repetition draw; adjudication after 240 half-moves if |material| ≥ 300; exact status strings ("CHECKMATE! White Wins", "Draw by Repetition", " (CHECK)" suffix, …) — tests/UI match on them.
- **Two evals**: `eval_core.js` (personas material/positional/aggressive: PSTs, mobility ×3, pawn structure, capture pressure, tempo, `Math.round` — use f64 with identical op order + js_round = floor(x+0.5)) and `evaluate.c` (material+PST, side-to-move). Port both.
- **Two searches**: JS persona search (unordered negamax + captures-only quiescence qDepth 4, deadline, iterative deepening capped at depth 8 under budget, root-only bonuses, `onSearchUpdate` info events, `lastDecision`) and C engine search (capture-first ordering, quiescence with checks, mate scores `-100000+ply`, `search_timed` per-depth re-search with 0.9 budget). Port both.
- **UCI** (from `uci.c`): `uci/isready/ucinewgame/position startpos [moves]/go [depth|randomness|movetime|clocks]/d/quit`, custom `legal` + `eval`, `bestmove 0000`; square codec file a–i, rank = 9−row. Add `position fen` (new, wrapper already sends it).

## WASM boundary (crates/shatrunz-wasm)

- `WasmGame` class: `new/from_uci_moves/board/turn/legal_moves_for(r,c)/all_legal_moves/execute_move/undo_last_move/check_status/position_key/get_score/is_king_in_check/to_pgn/phase` — JSON shapes identical to today's JS objects.
- Free fns: `parse_uci_move`, `move_to_uci`, `parse_pgn`, `evaluate_position_white`, `eval_breakdown`, `clock_budget_ms`, `explain_move`, `search_best_move(game, opts, on_info)` where `opts = {color, persona, depth, budgetMs, randomness, rootBonuses, positionValue}`.
- **Search runs in a module Web Worker** (`frontend/workers/ai_worker.js`) instead of ai.js's setTimeout-yield: worker loads `/pkg/shatrunz_wasm.js`, streams info events via postMessage. Main-thread direct call as fallback.
- **Adapter strategy**: keep module paths, swap contents. `frontend/rules.js`, `game.js`, `shared/eval_core.js`, `uci.js`, `game_phase.js`, `pgn_parse.js`, `clock_budget.js`, `opening_book.js`, `move_explainer.js`, `replay.js`, `replay_step.js`, `ai.js` (AIPlayer facade) become thin adapters over `frontend/pkg/`; `game.js` adapter mirrors the board to a JS 9×9 snapshot after each mutation (ui.js reads `game.board[r][c]` everywhere).
- **Stays JS**: brain.js (localStorage; passes rootBonuses/positionValue numbers into search), settings_store, policy_net (fetch), api.js, ui.js, board_view, main.js, admin_main, modes/*, clock_controller (timers), help_signal, engine_move, engine_pv_panel, persona chart/labels.
- Build: `wasm-pack build crates/shatrunz-wasm --target web --release -d ../../frontend/pkg` (no-bundler frontend imports `/pkg/shatrunz_wasm.js` directly); `--target nodejs -d pkg-node` for node parity tests. Frontend bootstraps with one-time `await init()`.

## ShatrunZ MCP (crates/shatrunz-mcp) — highest-compounding stage, built right after core+eval+search

Bin `shatrunz-mcp` speaking MCP over stdio (JSON-RPC 2.0) via the official `rmcp` Rust SDK (fallback: hand-rolled stdio loop if `rmcp` is unfetchable). Links `shatrunz-core` **in-process** — no UCI round-trip — so it exposes eval breakdowns, search info, perft, and live weight overrides that plain UCI cannot. Holds `HashMap<GameId, Game>` in memory (+ optional snapshot to `data/mcp/`). Registered in repo-root `.mcp.json` so every in-repo Claude session inherits the tools.

Tools:
- `new_game {startpos|fen|moves}` → `{game_id, ascii, fen, position_key, turn, status}`
- `get_state {game_id}` → `{board, ascii, fen, turn, legal_uci[], status, position_key}`
- `legal_moves {game_id, square?}` → `[uci]`
- `make_move {game_id, uci}` → `{ok, state}` or `{error:"illegal", legal_uci[]}`  ← **rule-bug detector**
- `engine_move {game_id, persona, depth|movetime, randomness}` → `{uci, score_cp, pv[], nodes, depth}`
- `evaluate {game_id, persona}` → `{total, material, pst, mobility, pawns, capture, phase}`  ← **eval-critique surface**
- `analyze {game_id, depth, multipv}` → `[{uci, score_cp, pv[]}]`
- `perft {fen|game_id, depth}` → `{nodes, per_move}`  ← **correctness oracle**
- `self_play {white:{persona,depth}, black:{...}, max_plies, adjudicate}` → `{result, pgn, eval_trace[], position_keys[]}`  ← **fixture + training-data + win-rate generator**
- `tournament {personas[], games, depth}` → `{win_matrix}`  ← **measures eval/search changes**
- `set_persona_weights {persona, weights}` / `reset_weights`  ← in-session eval-tuning harness (temp override)
- `import_pgn` / `export_pgn`

Flywheel (why it compounds): an agent plays or self-plays → surfaces a blunder or an illegal-move rule bug → converts it to a fixture in the parity suite → fixes core → re-plays via `self_play`/`tournament` → reads the win-rate delta. Every later dev session then uses the same tools to (a) verify its own changes end-to-end, (b) auto-generate perft/eval/search fixtures instead of hand-writing them, (c) tune personas by measured self-play. It needs only M1+M2, so building it early accelerates M4–M7. Parity bonus: `self_play`/`perft` output diffs directly against the JS oracles (`tools/js/legal_moves.mjs`, existing self-play scripts) to surface divergences faster than static fixtures.

## Native engine (crates/shatrunz-engine)

Rights-mode + underpromotions + `eval::engine` + `search::engine`, exact `uci.c` I/O formats. Copied to `engine/shatrunz_engine` during transition so `engine_wrapper.py`, `pytest tests/`, `tests/engine_mate_in_1.sh` run unmodified against it — that's the C-parity gate. The Rust server calls core **in-process** (spawn_blocking) for default engine; `UCI_ENGINE_PATH` kept as a tokio subprocess UCI client (port of engine_wrapper.py) for Fairy-Stockfish.

## Rust server (crates/shatrunz-server)

1:1 route port of `backend/server.py` (same JSON shapes/status codes): pages `/`, `/pvp|pvai|aivai`, `/admin`; static via tower-http ServeDir (correct `application/wasm` MIME); `POST /api/engine-move|engine-eval` (in-process core); `POST /api/engine-search` (NDJSON stream); `/api/save-game` (PGN+JSON files + rusqlite dual-write), `/api/save-brain`, `/api/load-brain/:name`, `/api/games`, `/api/analyze-game`, `/api/health`, `/api/stats/summary` (port stats.py), `/api/db/stats`, `/api/tablebase`, `/api/training-runs`; `POST /api/ml/train` + `/status` + `/stream` (SSE) — port training_jobs.py, spawning `python tools/export_ml.py` + `python -m ml.train` via tokio::process with 2000-line ring buffer; `/api/ml/policy-hint` → persistent Python stdio sidecar `ml/hint_server.py` (model is a .pt torch checkpoint; ort/ONNX deferred), graceful `{success:false,bonuses:{}}` degradation; `/api/inspector/*` → thin `backend/inspector_cli.py` subprocess wrapper; `/api/ml/metrics` reads models/metrics_v1.json. Permissive CORS, port 8000. `start.sh` runs the server binary; Dockerfile becomes multi-stage rust-build → python:3.12-slim runtime.

## Parity verification (gates deletion)

- **P1 Perft**: `tools/js/perft.mjs` dumps perft(1–3) fixtures from startpos + ~200 seeded random positions (uci-move prefixes); Rust test replays and asserts counts. Same vs C engine `legal` for Rights mode.
- **P2 Eval parity**: JS dump of `evaluatePositionWhite`/`evaluateForSearch` + breakdown per persona vs Rust, exact integer equality; C `eval` vs `eval::engine`.
- **P3 Search parity**: deterministic config (no randomness/bonuses/deadline, fixed depth 2–3) — bestmove+score JS vs Rust, C vs Rust.
- **P4 Fuzz invariants**: port `fuzz_rules_invariants` + `invariants/game_invariants.js` to Rust with a mulberry32 port.
- **P5 Engine drop-in**: existing pytest suite + mate-in-1 script pass against the Rust binary.
- **P6 WASM boundary**: `--target nodejs` build; side-by-side old-JS vs adapter test over seeded games; existing tests-js pure-module suites pass unmodified through the adapters.
- **P7 Server contracts**: port test_backend_contracts/test_api_health/test_stats_summary to HTTP against the spawned axum server.
- Manual smoke: all four pages, PGN export/import, undo, replay, clocks, brain persistence, train-job stream.

## Milestones (commit points on `claude/rust-port-bl0o62`)

1. **M0** Scaffold: wasm-pack install, workspace builds, `docs/RUST_PORT.md` checklist created, justfile/Makefile.
2. **M1** Core rules/game + position_key + statuses → P1 green.
3. **M2** Both evals + both searches + clock_budget → P2–P4 green.
4. **M3 — ShatrunZ MCP** (built early, needs only M1+M2): `crates/shatrunz-mcp`, `.mcp.json`, tools above; smoke via a self-play game + perft through the MCP. Unlocks the agent play/tune flywheel for every later session.
5. **M4** UCI engine binary + FEN → P5 green.
6. **M5** WASM crate, worker, frontend adapters, `init()` bootstrap → P6 green + manual smoke.
7. **M6** axum server + sidecars + start.sh/Dockerfile → P7 green (Flask runnable side-by-side on alt port during verification).
8. **M7** Deletion (only after M1–M6 green in one run): old JS logic bodies, `engine/*.c|*.h|Makefile|engine_wrapper.py`, `backend/server.py|stats.py|training_jobs.py|version.py`, `start.py`; keep `backend/db.py` if `tools/export_ml.py` still imports it (checklist item). Rewrite `package.json` test script (surviving boundary/DOM tests + `cargo test` + pytest). Update README/docs. Push after each milestone with `git push -u origin claude/rust-port-bl0o62`.

## docs/RUST_PORT.md checklist format

Tables: item | source file:line | Rust location | ported | parity-verified | old deleted. Sections: rules/movement, game state, eval, persona search, engine search, UCI commands, server routes + response shapes, DB schema, per-frontend-module disposition, build/deploy artifacts, test replacements, deferred items (Zobrist hashing, ort/ONNX in-process, wasm threads, engine strength improvements).

## Key technical risks

- Float parity in HCE eval → f64 identical op order + js_round; caught by P2.
- Search tie-breaks depend on generation order → replicate JS/C iteration orders exactly.
- ui.js board reads → adapter keeps 81-cell JS mirror, refreshed per mutation.
- wasm-pack install through proxy → validated in M0 before anything else; fallbacks listed.
- Existing JS↔C divergences (castling rights, underpromotion) are *preserved* via dual modes, documented in the checklist — unification is a deliberate post-port item.

## Multi-session development risks & disciplines (what derails the port)

This port spans many cold-start sessions. Each risk below is paired with the discipline that prevents derailment. **These are load-bearing — skipping them is how the port silently breaks.**

1. **Losing the parity oracle (the fatal one).** The whole plan depends on JS/C/Python being the ground truth. If any session deletes original logic before parity is proven, the truth is gone and can never be recovered. **Discipline:** deletion is its own terminal milestone (M7); the checklist's "old deleted" column stays empty until "parity-verified" is green for that item; tag the last full pre-deletion tree (`git tag pre-rust-oracle`) so it's always recoverable.

2. **Cold-start re-derivation drift.** A fresh session re-implements from memory and gets a quirk subtly wrong (position_key byte format, generation order, adjudication thresholds). **Discipline:** `docs/RUST_PORT.md` is updated at the **end of every session**, not just milestones, with exact current state; every session **starts** by reading it + the plan file. Each quirk is a cited checklist row (`source file:line`) with a parity test, so it's copied, not reinvented.

3. **Frozen external contracts get "improved."** `position_key` is the SQLite/tablebase key; status strings are matched by tests and UI. A session that doesn't know this could reword or reformat them and break the DB/server invisibly. **Discipline:** mark these **FROZEN** in the checklist; changing them is out of scope for the port.

4. **Silent parity drift — marked ported but not verified.** "Ported" and "parity-verified" get conflated; a flaky/skipped harness lets a divergence through. **Discipline:** two separate checklist columns; all parity tests are deterministic (seeded mulberry32); "ported" never authorizes deletion — only "parity-verified" does.

5. **Scope creep / premature optimization.** A session rewrites search with Zobrist/rayon/better ordering "while in there," breaking parity and burning the session. **Discipline:** port faithfully first — bug-for-bug — and defer every improvement to the explicit post-M7 list. The dual `CastlingMode` and auto-queen-vs-underpromotion split are *deliberately* kept; do not unify mid-port.

6. **Frontend adapter big-bang left half-wired.** M5 touches 20+ files; done as one sprawling change across sessions it's unbisectable and can leave the app broken for multiple sessions. **Discipline:** commit per adapter group, keep the JS fallback path until that group's P6 test is green, fix the 81-cell board-mirror pattern once up front.

7. **Non-reproducible toolchain in a fresh container.** Ephemeral containers may lack the wasm target / wasm-pack; a session wastes time re-discovering setup. **Discipline:** M0 pins `rust-toolchain.toml`, scripts every build in the justfile, and records exact install commands (incl. proxy notes) in the checklist so setup is one command.

8. **Branch divergence across sessions.** Parallel/overlapping sessions force-push over each other or lose commits. **Discipline:** one branch `claude/rust-port-bl0o62`; every session pushes at each milestone and **starts** by fetching + inspecting remote state; rebase, never duplicate; if the PR merged, restart from default per the task rules rather than stacking.

9. **The MCP flywheel goes unused.** If later sessions hand-write fixtures instead of generating them via `self_play`/`perft`/`tournament`, the compounding benefit evaporates and coverage stays thin. **Discipline:** once M3 lands, fixture generation and change-verification go **through the MCP**; the checklist references MCP-generated artifacts as the fixture source of record.
