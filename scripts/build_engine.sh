#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Building C engine..."
make -C "${ROOT_DIR}/engine" clean
make -C "${ROOT_DIR}/engine"

echo "OK: ${ROOT_DIR}/engine/shatrunz_engine"

