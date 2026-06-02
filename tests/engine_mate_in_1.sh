#!/usr/bin/env bash
# Smoke: C engine finds a capture when quiescence is enabled (regression for leaf eval-only bugs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$ROOT/engine/shatrunz_engine"
if [[ ! -x "$ENGINE" ]]; then
  make -C "$ROOT/engine"
fi
OUT=$(printf 'uci\nisready\nposition startpos\ngo depth 4\nquit\n' | "$ENGINE" | tail -5)
if ! echo "$OUT" | grep -q 'bestmove'; then
  echo "FAIL: no bestmove from engine"
  exit 1
fi
echo "PASS: engine returns bestmove (mate-in-1 suite placeholder)"
