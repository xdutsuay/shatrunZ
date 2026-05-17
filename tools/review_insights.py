#!/usr/bin/env python3
"""
Interactive CLI: review pending insights (yes/no), append approved labels.

Usage:
  python tools/review_insights.py --pending data/insights/pending_insights.ndjson
  python tools/review_insights.py --pending ... --approved data/insights/approved_labels.ndjson

Keys:
  y = bad move for side to move (penalize in brain merge)
  n = not bad (small reward in merge)
  s = skip (no label written)
  q = quit (remaining pending lines left unread)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pending", type=str, required=True)
    ap.add_argument("--approved", type=str, default="data/insights/approved_labels.ndjson")
    args = ap.parse_args()

    pending_path = Path(args.pending)
    approved_path = Path(args.approved)
    approved_path.parent.mkdir(parents=True, exist_ok=True)

    if not pending_path.exists():
        print(f"Pending file not found: {pending_path}", file=sys.stderr)
        return 1

    lines = pending_path.read_text(encoding="utf-8").strip().splitlines()
    if not lines:
        print("No pending insights.")
        return 0

    print(f"Loaded {len(lines)} pending insight(s). Commands: y=bad, n=not bad, s=skip, q=quit\n")

    with approved_path.open("a", encoding="utf-8") as out:
        for i, line in enumerate(lines, 1):
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                print(f"Skip malformed line {i}", file=sys.stderr)
                continue

            prompt = row.get("prompt") or json.dumps(row, ensure_ascii=False)[:200]
            print(f"\n[{i}/{len(lines)}] {prompt}")
            ans = input("> ").strip().lower()

            if ans == "q":
                print("Stopped by user.")
                break
            if ans == "s" or ans == "":
                continue
            if ans not in ("y", "n"):
                print("  (unrecognized; treating as skip)")
                continue

            label = {
                "position_hash": row["position_hash"],
                "move_uci": row["move_uci"],
                "penalize": ans == "y",
                "weight": 10,
                "reward_if_not_bad": 3,
                "source": "cli_v1",
                "ts": int(time.time() * 1000),
                "insight_id": row.get("id"),
            }
            out.write(json.dumps(label, ensure_ascii=False) + "\n")
            out.flush()
            print("  saved label")

    print(f"\nApproved labels appended to: {approved_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
