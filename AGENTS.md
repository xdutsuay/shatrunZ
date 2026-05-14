# ShatrunZ Development Guide

## Cursor Cloud specific instructions

### Overview
ShatrunZ is a 9x9 chess variant with a custom C engine, Flask backend, and vanilla JS frontend. The three components are:
- **C Engine** (`engine/`): UCI-protocol chess engine compiled via `make -C engine`
- **Flask Backend** (`backend/server.py`): API server on port 8000, serves frontend static files and proxies engine moves
- **Frontend** (`frontend/`): Vanilla HTML/JS/CSS, no build step required

### Running the app
1. Activate venv: `source .venv/bin/activate`
2. Build engine (if binary missing): `make -C engine`
3. Start server: `python -c "import sys; sys.path.insert(0,'.'); sys.path.insert(0,'backend'); from server import app; app.run(host='0.0.0.0', port=8000)"` or use `python start.py` (requires venv check)
4. Web UI at http://localhost:8000

### Testing
- `pytest -q` from repo root (with venv activated)
- Tests are in `tests/` directory: `test_api_health.py`, `test_engine_uci.py`, `test_engine.py`, `test_castling.py`
- CI mirrors: `make -C engine clean && make -C engine && pytest -q`

### Key gotchas
- `start.py` enforces a venv check (`check_venv()`) and will exit if not in a virtual environment. For direct server startup, import `server.app` directly instead.
- The engine binary (`engine/shatrunz_engine`) is not committed; `server.py` auto-builds it via `make` if missing.
- GCC warnings during engine build (format-overflow in `uci.c`) are expected and non-fatal.
