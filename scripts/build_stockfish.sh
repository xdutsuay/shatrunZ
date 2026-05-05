#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SF_DIR="${ROOT_DIR}/engine/third_party/stockfish"

if [[ ! -d "${SF_DIR}/src" ]]; then
  echo "Stockfish submodule not initialized."
  echo "Run: git submodule update --init --recursive"
  exit 1
fi

cd "${SF_DIR}/src"

# Pick a reasonable default. Users can override by exporting STOCKFISH_ARCH.
ARCH="${STOCKFISH_ARCH:-}"
if [[ -z "${ARCH}" ]]; then
  case "$(uname -s)" in
    Darwin)
      # Apple Silicon and Intel are both common; rely on Stockfish's auto build if possible.
      ARCH="apple-silicon"
      ;;
    Linux)
      ARCH="x86-64-modern"
      ;;
    *)
      ARCH="x86-64"
      ;;
  esac
fi

echo "Building Stockfish (ARCH=${ARCH})..."
make clean >/dev/null 2>&1 || true
make build -j ARCH="${ARCH}"

echo "Built Stockfish binary under: ${SF_DIR}/src"

