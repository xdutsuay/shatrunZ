## Fairy-Stockfish (backend engine) for ShatrunZ

Fairy-Stockfish is a Stockfish-family engine designed for **variants** (custom board sizes, pieces, rules).
It is the most practical “strong engine” to plug into ShatrunZ.

### 1) Initialize submodules

```bash
git submodule update --init --recursive
```

### 2) Build Fairy-Stockfish (native)

```bash
bash scripts/build_fairy_stockfish.sh
```

### 3) Point ShatrunZ backend at Fairy-Stockfish

We use the repo’s existing external-UCI mechanism:
- `UCI_ENGINE_PATH`: engine binary path
- `UCI_ENGINE_INIT`: extra UCI commands (sent after wrapper init)

```bash
export UCI_ENGINE_PATH="/absolute/path/to/engine/third_party/fairy-stockfish/src/stockfish"
export UCI_ENGINE_INIT=$'setoption name VariantPath value /absolute/path/to/engine/variants/shatrunz.ini\nsetoption name UCI_Variant value shatrunz\nisready'
python start.py
```

Verify:

```bash
curl http://localhost:8000/api/health
```

You should see:
- `engine_kind: "external_uci"`

### Accuracy note (Krishna semantics)
Our Krishna rules are unusual (non-capturing, non-checking). Pure `variants.ini` piece defs can’t perfectly encode that.
This integration is still useful for **training/sparring** (strong search + evaluation), but for full rules fidelity we’ll need either:
- adjust the variant definition to match Fairy-Stockfish-supported semantics, or
- implement custom rule hooks (larger project).

