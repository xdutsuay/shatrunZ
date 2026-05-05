#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(cat "${ROOT_DIR}/VERSION" | tr -d '[:space:]')"

OUT_DIR="${ROOT_DIR}/dist/shatrunz-${VERSION}"

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

echo "Packaging shatrunZ ${VERSION}..."

# Ensure engine is built
bash "${ROOT_DIR}/scripts/build_engine.sh"

# Copy runtime files
mkdir -p "${OUT_DIR}/backend" "${OUT_DIR}/frontend" "${OUT_DIR}/engine" "${OUT_DIR}/docs"
cp -R "${ROOT_DIR}/backend/" "${OUT_DIR}/backend/"
cp -R "${ROOT_DIR}/frontend/" "${OUT_DIR}/frontend/"
cp -R "${ROOT_DIR}/docs/" "${OUT_DIR}/docs/"
cp "${ROOT_DIR}/start.py" "${OUT_DIR}/start.py"
cp "${ROOT_DIR}/requirements.txt" "${OUT_DIR}/requirements.txt"
cp "${ROOT_DIR}/VERSION" "${OUT_DIR}/VERSION"

# Copy engine binary + minimal sources for transparency/debugging
cp "${ROOT_DIR}/engine/shatrunz_engine" "${OUT_DIR}/engine/shatrunz_engine"
cp "${ROOT_DIR}/engine/Makefile" "${OUT_DIR}/engine/Makefile"
cp "${ROOT_DIR}/engine/"*.c "${OUT_DIR}/engine/" 2>/dev/null || true
cp "${ROOT_DIR}/engine/"*.h "${OUT_DIR}/engine/" 2>/dev/null || true

echo "Creating archive..."
mkdir -p "${ROOT_DIR}/dist"
tar -C "${ROOT_DIR}/dist" -czf "${ROOT_DIR}/dist/shatrunz-${VERSION}.tar.gz" "shatrunz-${VERSION}"

echo "OK: dist/shatrunz-${VERSION}.tar.gz"

