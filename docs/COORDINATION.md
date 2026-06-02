## Coordination: shatrunZ (Cursor + Antigravity)

This file is the shared handoff for continuing work on `shatrunZ` with limited Cursor budget and Antigravity support.

---

## Multi-IDE status (2026-05-17)

### Ownership

| IDE | Role | Owns next |
|-----|------|-----------|
| **Cursor** | Leader | Push/tag if requested; post-v0.2 engineering |
| **Antigravity** | Validation / demo / QA | Optional: browser UI pass (CDP was blocked); Work Log |

**Baton:** Phase C complete (Antigravity). Phase D release steps run in Cursor — tag `v0.2.0` + tarball unless user defers push.

### Git snapshot

- **Branch:** `NineBlockMaster`
- **HEAD:** `7bdedfa` — `docs: v0.2 handoff, position API notes, and coordination updates`
- **Recent commits (v0.2 session):**
  - `e335ade` — feat(learning): self-play, emit/review insights, merge, `train_one.sh`
  - `75dc5cd` — feat(ui): `mode_logic.js`, AI turn gating, settings UX
  - `38eee47` — fix(engine): UCI wrapper, castling + contract tests
  - `7bdedfa` — docs: `NEXT_STEPS.md`, `docs/position_api.md`, coordination
- **Working tree:** clean except untracked `.cursor/` (ignore)
- **Validation (Cursor, this session):** `pytest -q` 11 passed; `npm test` 6 passed

### Milestone v0.2 — done vs next

| Phase | Status | Notes |
|-------|--------|--------|
| A — Hygiene | **Done** | Plan 1 commits landed; tests green |
| B — Position API | **Done** | `uciMoveHistory` → `/api/engine-move`; `docs/position_api.md`; mid-game contract test |
| C — Learning loop | **Done** | Antigravity validated C1–C5 end-to-end (2026-05-17) |
| D — Release | **Done** (local) | `VERSION` = `0.2.0`; tag `v0.2.0`; `dist/shatrunz-0.2.0.tar.gz`; push on request |

### Active focus (next)

**Post–v0.2:** Push `NineBlockMaster` + tag to GitHub; optional Antigravity browser UI smoke (HvC black-side regression). **Out of scope until requested:** 25k self-play, Docker polish, Fairy-Stockfish default backend.

### File lock table (zero overlap)

| Path / area | Antigravity | Cursor |
|-------------|-------------|--------|
| `data/**` (self-play, insights, brains) | **WRITE** (local only, gitignored) | **no touch** |
| `frontend/`, `backend/`, `engine/`, `tools/` | read-only | **WRITE** only if merge/import bug |
| `docs/COORDINATION.md` | Work Log append only | full sync + Multi-IDE section |
| `VERSION`, `scripts/package_release.sh`, git tag/push | **no touch** | **WRITE** |
| `docs/NEXT_STEPS.md`, `docs/position_api.md` | read-only | update after Phase C if needed |

### Work Log

#### 2026-05-18 — Cursor (nvidia_worker smoke test)
- Local `nvidia_worker/` gitignored; run `bash scripts/nvidia_next_step.sh` (uses `.venv`, key from Cursor/NVIDIA_API_KEY)
- Test output: **Push tag v0.2.0 to origin.** (458 tok, llama-3.1-8b-instruct)

#### 2026-05-19 — Cursor (help UX, PGN help, phases, train_10min)
- Help status: "White/Black is asking for help" (reason as subtitle)
- PGN `[HelpMoves]` for human-assisted plies; phase detector + opening/endgame hooks
- `scripts/train_10min.sh`, `tools/krishna_stats.py`, JS policy-hint API
- Tests: npm 35 passed; pytest 22 passed

#### 2026-05-19 — Cursor (stabilize core + ML + parity)
- Undo: PvP/PvAI/AIvAI + `GameSession.undoLastPly` syncs PGN/brain
- PGN: import + `[UciMoves]` tag + step replay controls
- Help: composite auto-pause signal (`help_signal.js`)
- Engine: C `legal` UCI command + `tests/test_engine_parity.py`
- Self-play: `--workers` ProcessPoolExecutor
- ML: `ml/` package, `/api/ml/metrics`, Settings panel
- Tests: `npm test` 29+; `pytest` expanded

#### 2026-05-18 — Cursor (frontend refactor)
- Scope: PvP/PvAI/AIvAI mode modules, AIvAI persona dropdowns, Help AI, brain finalize, history in Settings, template move explainer
- Tests: `npm test` 15 passed; `pytest -q` 11 passed (venv)

#### 2026-05-17 — Cursor (leader)
- Scope: v0.2 implementation session (4 commits on `NineBlockMaster`)
- Done: learning pipeline, `mode_logic.js` + UI gating, engine/contracts, docs
- Validation: pytest 11 passed; npm test 6 passed
- Next: Antigravity Phase C; then Cursor tag `v0.2.0` + push

#### 2026-05-17 — Antigravity (validation)
- Scope: Phase C learning loop (C1–C5) + play mode QA (C7) + health check (C8)
- **C1** ✅ `train_one.sh --games 50`: 50 games, Elo (c_depth3: 1523, c_depth4: 1508, c_depth3_rand: 1469), 300 insights emitted to `data/insights/pending_insights.ndjson`
- **C3** ✅ `review_insights.py`: 10 y/n labels saved to `data/insights/approved_labels.ndjson` (5 penalize, 5 reward)
- **C4** ✅ `merge_feedback_into_brain.py`: Merged labels into `brain_material_ai_latest.json` → `data/insights/brain_merged.json` (187 memory keys, 9 value keys, version 3)
- **C5** ✅ Brain imported via `/api/save-brain`; AIvAI simulation: 10-ply game completed successfully via C engine at depth 3
- **C7** ✅ Mode QA (API-level, browser CDP unavailable):
  - HvC (AI=White depth 4, Human=Black): 3 AI moves generated correctly after human inputs
  - PvAI (Human=White, AI=Black depth 4): AI responded correctly to d2d3, e2e3
  - CvC (both AI, randomness=50): Non-deterministic moves observed (e8e6 vs deterministic b9a7)
- **C8** ✅ `curl /api/health`: `version: "0.2.0"`, `engine_available: true`, `engine_kind: "shatrunz_c"`, `status: "ok"`, `brains_count: 4`
- Tests: pytest 11 passed; npm test 6 passed (unchanged)
- Note: Browser subagent failed (CDP `Browser.setDownloadBehavior` not supported); all UI tests performed via API curl calls instead
- Next: Cursor tag `v0.2.0` + push

#### 2026-05-17 — Cursor (release)
- Scope: Phase D after Antigravity Phase C pass
- Done: `pytest -q` 11 passed; `npm test` 6 passed; `dist/shatrunz-0.2.0.tar.gz`; git tag `v0.2.0`
- Next: `git push` + push tag if user wants remote updated

---

### Historical baseline (pre–v0.2)

Earlier roadmap (rules, Docker, CI, packaging at 0.1.0) remains valid; see sections below. **Do not** treat demo `version: "0.1.0"` examples as current — use **0.2.0**.

### IMPORTANT: working tree hygiene
When you check `git status`, you may see deletions for generated artifacts (like `__pycache__`, `engine/*.o`, `.DS_Store`) from earlier commits. We added a root `.gitignore` to prevent them from reappearing.

Also note:
- `engine/shatrunz_engine` is tracked and changed (rebuilt). Keep it tracked only if you intentionally want to ship the binary in-repo. Otherwise, consider removing it from git and building on install/release.

---

## Demo instructions (local, no Docker)

### 1) Create/activate venv + install deps
```bash
cd /Users/nehatiwari/localcode/shatrunZ
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Build C engine
```bash
make -C engine clean && make -C engine
```

### 3) Run app (server + inspector)
```bash
python start.py
```

### 4) Verify backend health + version
In another terminal:
```bash
curl http://localhost:8000/api/health
```
Expect JSON containing:
- `status: "ok"`
- `version: "0.2.0"`
- `engine_available: true/false`

### 5) UI demo
Open `http://localhost:8000` and:
- Confirm **“Use C Engine”** is checked.
- Go to **AIvAI** tab.
- Click **Start AI**.
- Observe fast move generation (C engine), and inspector output in the terminal.

---

## Demo instructions (Docker)
Docker build failed earlier only because the Docker daemon was not reachable. If Docker Desktop is running:
```bash
cd /Users/nehatiwari/localcode/shatrunZ
docker compose up --build
```
Then open `http://localhost:8000`.

---

## Quick verification commands (recommended)

### Run tests
```bash
source .venv/bin/activate
pytest -q
```

### Run local frontend regression tests (optional, not in CI)
```bash
npm test
```

### Semi-supervised learning (CLI yes/no, does not slow self-play)

Fast engine self-play stays in `tools/selfplay.py` (writes `games.jsonl`). Human feedback is **offline**: generate prompts, answer y/n when you have time, merge into a brain JSON the UI can import.

1. **Emit pending insights** (replays games with browser `Game` + `Rules`; default `--mode annotate` works for draw-heavy runs):
   ```bash
   node tools/js/emit_insights.mjs --games-jsonl data/selfplay/run_YYYYMMDD_HHMMSS/games.jsonl --out data/insights/pending_insights.ndjson --max-insights 200 --opening-depth 12
   ```
   Use `--mode decisive` to only ask about opening moves in games where one side lost (`1-0` / `0-1`).

2. **Review** (interactive):
   ```bash
   python tools/review_insights.py --pending data/insights/pending_insights.ndjson --approved data/insights/approved_labels.ndjson
   ```
   - `y` = bad for side to move (penalize `memory[hash][move]` on merge)
   - `n` = not bad (small positive bump)
   - `s` = skip, `q` = quit

3. **Merge** into an exported brain (from UI **Export brain** or `brain_*.json`):
   ```bash
   python tools/merge_feedback_into_brain.py --brain path/to/brain.json --labels data/insights/approved_labels.ndjson --out path/to/brain_merged.json
   ```
   Optional: `--also-values` to nudge TD `values[hash]` slightly; `--in-place` overwrites the input (creates `.bak`).

4. **Import** `brain_merged.json` in the web UI (Import brain).

Optional slow lane (documentation only): `python tools/supervised_selfplay.py`

### Package a release tarball
```bash
bash scripts/package_release.sh
ls -la dist/
```

---

## Self-play strength testing (offline)

This repo now includes an **offline self-play runner** that can generate thousands of engine-vs-engine games, track a simple online Elo estimate, and produce a local HTML report.

### One command: train + build insight queue
Runs self-play, then fills `data/insights/pending_insights.ndjson` (defaults: 2000 games if you pass no args).
```bash
bash scripts/train_one.sh
bash scripts/train_one.sh --games 25000 --max-plies 220
```

### Run a small smoke test
```bash
bash scripts/run_selfplay.sh --games 50 --max-plies 220
```

### Run a full strength run (~25k games)
```bash
bash scripts/run_selfplay.sh --games 25000 --max-plies 220
```

### Outputs
- `data/selfplay/run_*/games.jsonl`: one JSON object per game (UCI move list + result + pairing info)
- `data/selfplay/run_*/summary.json`: aggregate results + current Elo
- `data/selfplay/run_*/report.html`: open in a browser to see Elo curves

---

## Known issues / follow-ups (optional)
- **Pytest warnings (BrokenPipe)**: Some older existing tests create/kill engine processes in a way that triggers `BrokenPipeError` warnings during teardown. Functionality is fine; consider cleaning up those tests later for a quieter test run.
- **Engine position API**: The UI sends `uciMoveHistory` (UCI from startpos) on each engine request. See `docs/position_api.md`. FEN fallback is optional and not required when the move list matches the board.
- **Game record standardization**: Backend stores PGN + metadata and queues analysis; could be tightened to ensure inspector inputs match saved metadata exactly.

---

## Handover prompts

See **Multi-IDE status** at top for current baton. Stale one-liner prompts removed — use the blocks returned by the Cursor coordinator or below when refreshed.

### Antigravity — Phase C + live QA (2026-05-17)

Mission: Run learning loop C1–C5 and spot-check play modes; append Work Log; do not commit.

### Cursor — release after Phase C (2026-05-17)

Mission: After Antigravity reports C1–C5 pass, tag `v0.2.0`, package, push; fix merge only if blocked.

