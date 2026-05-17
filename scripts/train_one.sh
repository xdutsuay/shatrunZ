#!/usr/bin/env bash
# One command: self-play training + build the yes/no insight queue for after.
# Usage:
#   bash scripts/train_one.sh
#   bash scripts/train_one.sh --games 5000 --max-plies 220
# Optional env:
#   MAX_INSIGHTS=300 OPENING_DEPTH=12 EMIT_MODE=annotate|decisive

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# Reasonable default if caller passes nothing
if [[ $# -eq 0 ]]; then
  set -- --games 2000 --max-plies 220
fi

echo "=== Step 1/2: self-play (engine training run) ==="
bash "${ROOT_DIR}/scripts/run_selfplay.sh" "$@"

LATEST="$(ls -1dt "${ROOT_DIR}/data/selfplay"/run_* 2>/dev/null | head -1 || true)"
if [[ -z "${LATEST}" || ! -f "${LATEST}/games.jsonl" ]]; then
  echo "Could not find data/selfplay/run_*/games.jsonl" >&2
  exit 1
fi

echo ""
echo "=== Step 2/2: building insight queue (no slowdown to step 1) ==="
MAX_INSIGHTS="${MAX_INSIGHTS:-300}"
OPENING_DEPTH="${OPENING_DEPTH:-12}"
EMIT_MODE="${EMIT_MODE:-annotate}"

node "${ROOT_DIR}/tools/js/emit_insights.mjs" \
  --games-jsonl "${LATEST}/games.jsonl" \
  --out "${ROOT_DIR}/data/insights/pending_insights.ndjson" \
  --max-insights "${MAX_INSIGHTS}" \
  --opening-depth "${OPENING_DEPTH}" \
  --mode "${EMIT_MODE}"

echo ""
echo "Done. Latest self-play run: ${LATEST}"
echo "Pending questions: ${ROOT_DIR}/data/insights/pending_insights.ndjson"
echo ""
echo "Help the model (yes/no):"
echo "  python tools/review_insights.py --pending data/insights/pending_insights.ndjson"
echo ""
echo "Then merge labels into an exported brain and import in the UI:"
echo "  python tools/merge_feedback_into_brain.py --brain your_brain.json --labels data/insights/approved_labels.ndjson --out brain_merged.json"
