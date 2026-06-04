#!/usr/bin/env bash
# Smoke: Fairy-Stockfish answers the shatrunz variant over UCI.
# Skips cleanly if the binary is not built (so it is safe in CI without the submodule).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FS_BIN="${UCI_ENGINE_PATH:-${ROOT}/engine/third_party/fairy-stockfish/src/stockfish}"
VARIANT_INI="${SHATRUNZ_VARIANT_INI:-${ROOT}/engine/variants/shatrunz.ini}"

if [[ ! -x "$FS_BIN" ]]; then
  echo "SKIP: Fairy-Stockfish binary not found at $FS_BIN"
  echo "      Build it: git submodule update --init --recursive && bash scripts/build_fairy_stockfish.sh"
  exit 0
fi
if [[ ! -f "$VARIANT_INI" ]]; then
  echo "SKIP: variant file not found at $VARIANT_INI"
  exit 0
fi

OUT=$(printf 'uci\nsetoption name VariantPath value %s\nsetoption name UCI_Variant value shatrunz\nisready\nposition startpos\ngo depth 1\nquit\n' \
  "$VARIANT_INI" | "$FS_BIN" | tail -20)

if ! echo "$OUT" | grep -q 'bestmove'; then
  echo "FAIL: no bestmove from Fairy-Stockfish for shatrunz variant"
  echo "$OUT"
  exit 1
fi

BEST=$(echo "$OUT" | grep 'bestmove' | tail -1 | awk '{print $2}')
if [[ "$BEST" == "0000" || "$BEST" == "(none)" || -z "$BEST" ]]; then
  echo "FAIL: Fairy-Stockfish returned no legal move ($BEST)"
  exit 1
fi

echo "PASS: Fairy-Stockfish bestmove for shatrunz startpos = $BEST"
