#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 -m venv "${ROOT_DIR}/.venv" >/dev/null 2>&1 || true
source "${ROOT_DIR}/.venv/bin/activate"

python -m pip install -q --upgrade pip
python -m pip install -q -r "${ROOT_DIR}/requirements.txt"

# Ensure engine exists (same behavior as backend auto-build, but explicit here).
if [[ ! -x "${ROOT_DIR}/engine/shatrunz_engine" ]]; then
  echo "Engine binary missing; building..."
  make -C "${ROOT_DIR}/engine"
fi

python "${ROOT_DIR}/tools/selfplay.py" "$@"

