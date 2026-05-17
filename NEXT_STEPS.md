# shatrunZ — Next Steps

Handoff for working on this repo individually. Branch: **`NineBlockMaster`** (not `master`).

**Graph (optional):** `graphify-out/GRAPH_REPORT.md` and `graph.html` — hubs: `ShatrunZEngine`, `ui.js`, `GameBrain`. Ignore `engine/third_party/` when reading the graph.

**Also read:** `COORDINATION.md` for demo commands and self-play workflow details.

---

## Plan 1 — Commit plan (dirty files)

Do **not** commit binaries, build artifacts, or local runtime data.

### Commit 1 — Self-play + insight pipeline (new files)

**Stage:**

- `tools/selfplay.py`
- `tools/review_insights.py`
- `tools/merge_feedback_into_brain.py`
- `tools/supervised_selfplay.py`
- `tools/js/emit_insights.mjs`
- `tools/js/insight_heuristics.mjs`
- `scripts/run_selfplay.sh`
- `scripts/train_one.sh`

**Suggested message:**

```
feat(learning): offline self-play, insight emit/review, and brain merge tools
```

### Commit 2 — Frontend mode logic + UI

**Stage:**

- `frontend/mode_logic.js` (untracked)
- `frontend/ui.js` (modified)
- `package.json` (untracked — needed if you run `npm test`)

**Suggested message:**

```
feat(ui): mode/strategy logic, collapsible settings, and brain UX
```

### Commit 3 — Engine wrapper + tests

**Stage:**

- `engine/engine_wrapper.py`
- `tests/test_castling.py`
- `tests/test_backend_contracts.py` (untracked)
- `tests/test_merge_feedback.py` (untracked)
- `tests-js/` (optional — include if you want JS tests in CI later)

**Suggested message:**

```
fix(engine): UCI wrapper improvements; expand castling and contract tests
```

### Commit 4 — Docs + dev scripts

**Stage:**

- `COORDINATION.md`
- `scripts/watch_tests.py` (diff only; other scripts in Commit 1)

**Suggested message:**

```
docs: coordination handoff and self-play workflow instructions
```

### Do **not** commit

| Path | Why |
|------|-----|
| `.cursor/` | IDE config |
| `data/` | Already in `.gitignore` (self-play runs stay local) |
| `graphify-out/` | Already in `.gitignore` |

### Pre-commit check

```bash
make -C engine clean && make -C engine
pytest -q
```

---

## Milestone — v0.2 “Position-aware play + one full learning loop”

**Outcome:** (1) AI uses the **current board**, not only `startpos`. (2) You complete **self-play → insights → merged brain → import** once end-to-end.

**Why:** Graph path is `ShatrunZEngine` → `ui.js` → `BackendAPI`. `COORDINATION.md` lists the position API as the main product gap. Learning tools exist but are mostly untracked until Plan 1 commits land.

### Phase A — Hygiene (½ day)

| Step | Action | Done when |
|------|--------|-----------|
| A1 | Stay on `NineBlockMaster` | `git branch` shows correct branch |
| A2 | Run Plan 1 commits 1–4 (or one squashed commit) | Clean `git status` except `data/` |
| A3 | `make -C engine && pytest -q` | Tests green (BrokenPipe warnings OK per `COORDINATION.md`) |
| A4 | `curl http://localhost:8000/api/health` | `version`, `engine_available: true` |

### Phase B — Position API (2–3 days)

**Problem:** Frontend calls the engine without sending the current position (`COORDINATION.md` known issue).

| Step | Work | Files (likely) |
|------|------|----------------|
| B1 | Define contract: JSON or FEN + optional move list | `docs/` or `COORDINATION.md` |
| B2 | Backend: `POST /api/engine/move` (or extend existing) accepting position | `backend/` API module |
| B3 | `engine_wrapper.py`: wire full position through UCI `position` + `go` | `engine/engine_wrapper.py` |
| B4 | Frontend: serialize board → API before AI move | `frontend/ui.js`, `frontend/api.js` |
| B5 | Test: mid-game FEN returns legal move | `tests/test_engine_uci.py` or `tests/test_backend_contracts.py` |

**Acceptance criteria:**

- Human makes 5+ moves, enables AI — engine responds from **that** position, not reset.
- Inspector/logs show FEN or equivalent sent to backend.

### Phase C — One full learning loop (1–2 days)

| Step | Command / action | Output |
|------|------------------|--------|
| C1 | `bash scripts/train_one.sh` (or `run_selfplay.sh --games 50 ...`) | `data/selfplay/run_*/games.jsonl` + `pending_insights.ndjson` |
| C2 | (skip if using `train_one.sh`) `node tools/js/emit_insights.mjs ...` | Pending insights file |
| C3 | `python tools/review_insights.py --pending ...` | Answer ≥10 lines (`y`/`n`) |
| C4 | `python tools/merge_feedback_into_brain.py --brain ... --labels ...` | `brain_merged.json` |
| C5 | UI: Import brain → AIvAI uses updated weights | Visible behavior change or logged memory hit |

**Acceptance criteria:**

- One merged brain imported and used in a game.
- `report.html` from self-play opens and shows Elo/summary.

### Phase D — Tag v0.2 (½ day)

| Step | Action |
|------|--------|
| D1 | Bump `VERSION` → `0.2.0` |
| D2 | `bash scripts/package_release.sh` |
| D3 | Git tag `v0.2.0` on `NineBlockMaster` |

**Out of scope for v0.2:** Docker polish, Stockfish submodule changes, large 25k-game runs, frontend image assets.

**Time budget:** ~4–6 focused days.

**After milestone:** `graphify update .` (from repo root).

---

## Quick start when opening this repo

**v0.2 milestone complete (2026-05-17).** See `COORDINATION.md` Multi-IDE status + Work Log.

1. `git pull` on `NineBlockMaster` (and `git fetch --tags` after remote push).
2. Play: `python start.py` → http://localhost:8000
3. Train + teach: `bash scripts/train_one.sh` → `python tools/review_insights.py ...`
4. **Next engineering:** push tag `v0.2.0`, browser UI QA (Antigravity), or v0.3 scope (FEN fallback, brain v4 merge path).
