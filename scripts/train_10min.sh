#!/usr/bin/env bash
# One bounded training cycle: ~10 min self-play + train + eval + Krishna stats report.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DURATION_SEC="${DURATION_SEC:-600}"
WORKERS="${WORKERS:-$(( $(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4) - 1 ))}"
WORKERS=$(( WORKERS < 1 ? 1 : WORKERS ))

echo "==> Building C engine"
make -C engine

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT/data/selfplay/run_10min_${TS}"
mkdir -p "$ROOT/models"

echo "==> Self-play for ${DURATION_SEC}s (workers=${WORKERS})"
START=$(date +%s)
# macOS has no GNU timeout; selfplay.py supports --duration-sec natively.
python tools/selfplay.py \
  --games 50000 \
  --max-plies 120 \
  --duration-sec "$DURATION_SEC" \
  --workers "$WORKERS" \
  --out "$OUT_DIR" \
  --report-every 0
END=$(date +%s)
ELAPSED=$(( END - START ))

GAMES_JSONL="$OUT_DIR/games.jsonl"
if [[ ! -f "$GAMES_JSONL" ]]; then
  echo "No games.jsonl produced; aborting train." >&2
  exit 1
fi
GAME_COUNT=$(wc -l < "$GAMES_JSONL" | tr -d ' ')
echo "Self-play: ${GAME_COUNT} games in ${ELAPSED}s"

REPORT_JSON="$ROOT/models/train_report_${TS}.json"
REPORT_MD="$ROOT/models/train_report_${TS}.md"

if python -c "import torch" 2>/dev/null; then
  echo "==> Training policy net"
  python ml/train.py --games-jsonl "$GAMES_JSONL" --max-games "$GAME_COUNT" --epochs 3 || true
  echo "==> Evaluating"
  python ml/eval.py --games-jsonl "$GAMES_JSONL" --out "$ROOT/models/metrics_v1.json" || true
  python ml/export_onnx.py 2>/dev/null || true
else
  echo "PyTorch not installed; skip train." >&2
  echo "  Install: pip install -r requirements-ml.txt   (package name is torch, not pytorch)" >&2
fi

echo "==> Krishna / run stats"
python tools/krishna_stats.py --games-jsonl "$GAMES_JSONL" --out-json "$REPORT_JSON" --out-md "$REPORT_MD"

python - <<PY
import json
from pathlib import Path
p = Path("$REPORT_JSON")
data = json.loads(p.read_text()) if p.is_file() else {}
data["duration_sec"] = $ELAPSED
data["games_played"] = $GAME_COUNT
data["rate_games_per_sec"] = round($GAME_COUNT / max($ELAPSED, 1), 3)
data["selfplay_dir"] = "$OUT_DIR"
p.write_text(json.dumps(data, indent=2))
print(f"Report: {p}")
print(f"Markdown: $REPORT_MD")
PY

echo "Done."
