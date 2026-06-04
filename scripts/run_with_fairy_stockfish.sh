#!/usr/bin/env bash
# Launch ShatrunZ with Fairy-Stockfish as the backend UCI engine.
#
# Prerequisites:
#   git submodule update --init --recursive
#   bash scripts/build_fairy_stockfish.sh
#   source .venv/bin/activate
#
# This wires the existing external-UCI mechanism in backend/server.py:
#   UCI_ENGINE_PATH  -> engine binary to launch
#   UCI_ENGINE_INIT  -> newline-separated UCI commands sent after init
#                       (VariantPath + UCI_Variant for the 9x9 shatrunz variant)
#
# Krishna caveat: Fairy-Stockfish's z:mK piece can capture/check, unlike real
# Krishna. Use this for strong sparring/search; frontend/rules.js stays
# authoritative for move legality. See docs/FAIRY_STOCKFISH_BACKEND.md.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FS_BIN="${UCI_ENGINE_PATH:-${ROOT_DIR}/engine/third_party/fairy-stockfish/src/stockfish}"
VARIANT_INI="${SHATRUNZ_VARIANT_INI:-${ROOT_DIR}/engine/variants/shatrunz.ini}"

if [[ ! -x "${FS_BIN}" ]]; then
  echo "Fairy-Stockfish binary not found or not executable: ${FS_BIN}" >&2
  echo "Build it first:" >&2
  echo "  git submodule update --init --recursive" >&2
  echo "  bash scripts/build_fairy_stockfish.sh" >&2
  echo "Or set UCI_ENGINE_PATH to an existing variant-capable engine." >&2
  exit 1
fi

if [[ ! -f "${VARIANT_INI}" ]]; then
  echo "Variant definition not found: ${VARIANT_INI}" >&2
  exit 1
fi

export UCI_ENGINE_PATH="${FS_BIN}"
export UCI_ENGINE_INIT=$'setoption name VariantPath value '"${VARIANT_INI}"$'\nsetoption name UCI_Variant value shatrunz'

echo "Engine:  ${UCI_ENGINE_PATH}"
echo "Variant: ${VARIANT_INI} (UCI_Variant=shatrunz)"
echo "Starting ShatrunZ backend with external UCI engine..."

cd "${ROOT_DIR}"
exec python start.py
