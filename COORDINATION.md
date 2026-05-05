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

### Package a release tarball
```bash
bash scripts/package_release.sh
ls -la dist/
```

---

## Known issues / follow-ups (optional)
- **Pytest warnings (BrokenPipe)**: Some older existing tests create/kill engine processes in a way that triggers `BrokenPipeError` warnings during teardown. Functionality is fine; consider cleaning up those tests later for a quieter test run.
- **Engine position API**: The plan mentioned standardizing a position format (FEN-like / JSON) so frontend can request moves for *current board*, not just `startpos`. This is not implemented yet. Today the frontend calls the engine without providing a position.
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

