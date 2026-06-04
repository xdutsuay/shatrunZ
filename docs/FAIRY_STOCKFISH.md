# Fairy-Stockfish integration

## Backend (current, supported)

Running Fairy-Stockfish as the **backend UCI engine** is the supported path. See the
canonical guide: [`FAIRY_STOCKFISH_BACKEND.md`](FAIRY_STOCKFISH_BACKEND.md).

TL;DR:

```bash
git submodule update --init --recursive
bash scripts/build_fairy_stockfish.sh
source .venv/bin/activate
bash scripts/run_with_fairy_stockfish.sh   # sets env, runs start.py
curl http://localhost:8000/api/health      # engine_kind: external_uci
```

No frontend change is needed — selecting **C Engine** in the play UI routes to whatever
native engine the backend launched.

## Browser WASM (deferred)

Compiling Fairy-Stockfish to WebAssembly and running it in a Web Worker (no server)
is a possible future enhancement. It is **not** implemented; archived experiment assets
live under `archive/frontend_engine/`. Tracking points if revived:

- WASM build is ~2–5 MB; lazy-load only when an engine persona is selected.
- Reuse the same UCI move-sync (`position startpos moves …`) and PV streaming contract.
- Same Krishna approximation caveat as the backend path
  (see [`FAIRY_STOCKFISH_BACKEND.md`](FAIRY_STOCKFISH_BACKEND.md)).
