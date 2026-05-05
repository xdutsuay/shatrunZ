## Stockfish in this repo

This repo vendors Stockfish as a **git submodule** at:
- `engine/third_party/stockfish`

### License note
Stockfish is licensed under **GPL**. If you distribute binaries built from it, you must comply with its license terms.

### Important compatibility note
ShatrunZ is currently a **9×9 variant with Krishna**. Standard Stockfish is a **standard chess (8×8)** engine and will not understand ShatrunZ rules.

So, Stockfish is included here for:
- future **standard chess mode**, or
- reference/testing, or
- comparing engine plumbing.

For a variant-capable engine, use Fairy-Stockfish (see `docs/FAIRY_STOCKFISH.md`).

### Build Stockfish

First initialize submodules:

```bash
git submodule update --init --recursive
```

Then build:

```bash
bash scripts/build_stockfish.sh
```

You can override the build arch:

```bash
STOCKFISH_ARCH=x86-64-modern bash scripts/build_stockfish.sh
```

### Use Stockfish with the backend (standard chess only)
Point the backend at the built Stockfish binary:

```bash
export UCI_ENGINE_PATH="/absolute/path/to/engine/third_party/stockfish/src/stockfish"
python start.py
```

Verify:

```bash
curl http://localhost:8000/api/health
```

