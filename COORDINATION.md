## Coordination: shatrunZ (Cursor + Antigravity)

This file is the shared handoff for continuing work on `shatrunZ` with limited Cursor budget and Antigravity support.

### Current status (as of this file)
All roadmap todos from `shatrunZ_future` were implemented:
- **Rules spec + rules alignment**
  - Added `docs/rules.md` as the rules source of truth.
  - Updated C engine to align Krishna behavior and castling validation:
    - Krishna **cannot be captured**, **does not capture**, and **does not give check**.
    - Castling now checks that the rook exists.
    - Files: `engine/position.c`
- **Hosted demo readiness**
  - Frontend API base URL is now relative: `frontend/api.js` uses `const API_BASE = '/api'`.
  - Added Docker artifacts: `Dockerfile`, `docker-compose.yml`.
- **Versioning + packaging**
  - Added `VERSION` (`0.1.0`).
  - `/api/health` now returns `version` (via `backend/version.py`).
  - Added packaging scripts: `scripts/build_engine.sh`, `scripts/package_release.sh` (creates `dist/shatrunz-0.1.0.tar.gz`).
- **Quality (tests + CI)**
  - Added pytest config: `pytest.ini`, `pytest` in `requirements.txt`.
  - Added tests: `tests/test_api_health.py`, `tests/test_engine_uci.py`.
  - Added GitHub Actions workflow: `.github/workflows/ci.yml`.

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
- `version: "0.1.0"`
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

## Handover prompt for Antigravity (copy/paste)

You are Antigravity assisting on repo `/Users/nehatiwari/localcode/shatrunZ` (branch `NineBlockMaster`).

Your goals:
1) Show the user the **current status** (what changed, which roadmap items are done).
2) Run a **live demo**: start the app, open the UI, run AIvAI with the C engine, and show `/api/health` output including version.
3) Report any blockers (e.g. engine not building, server not starting, CORS, Docker daemon).

Steps:
- Read `COORDINATION.md` first and follow the “Demo instructions”.
- Run `git status --porcelain` and summarize what is modified/untracked (do NOT commit unless asked).
- Run `make -C engine clean && make -C engine` and then `python start.py`.
- In another terminal `curl http://localhost:8000/api/health`.
- Confirm UI at `http://localhost:8000` loads and AIvAI runs with “Use C Engine” checked.

