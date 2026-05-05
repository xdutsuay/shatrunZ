#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FS_DIR="${ROOT_DIR}/engine/third_party/fairy-stockfish"

if [[ ! -d "${FS_DIR}/src" ]]; then
  echo "Fairy-Stockfish submodule not initialized."
  echo "Run: git submodule update --init --recursive"
  exit 1
fi

cd "${FS_DIR}/src"

# Build a native binary. Users can override by exporting FAIRY_ARCH.
ARCH="${FAIRY_ARCH:-}"
if [[ -z "${ARCH}" ]]; then
  case "$(uname -s)" in
    Darwin) ARCH="apple-silicon" ;;
    Linux) ARCH="x86-64-modern" ;;
    *) ARCH="x86-64" ;;
  esac
fi

echo "Building Fairy-Stockfish (ARCH=${ARCH})..."
make clean >/dev/null 2>&1 || true
make build -j ARCH="${ARCH}"

echo "Built Fairy-Stockfish binary under: ${FS_DIR}/src"

