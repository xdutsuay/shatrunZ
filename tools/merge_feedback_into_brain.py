#!/usr/bin/env python3
"""
Apply approved CLI labels to a GameBrain export JSON (v4), compatible with frontend/brain.js importFromJSON.

Usage:
  python tools/merge_feedback_into_brain.py \\
    --brain path/to/brain.json \\
    --labels data/insights/approved_labels.ndjson \\
    --out path/to/brain_merged.json

Optional:
  --also-values  nudge values[position_hash] slightly in same direction as memory
  --in-place     overwrite --brain (use with care)
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brain", type=str, required=True)
    ap.add_argument("--labels", type=str, required=True)
    ap.add_argument("--out", type=str, default="")
    ap.add_argument("--also-values", action="store_true")
    ap.add_argument("--in-place", action="store_true")
    args = ap.parse_args()

    brain_path = Path(args.brain)
    labels_path = Path(args.labels)

    if not brain_path.exists():
        print(f"Brain file not found: {brain_path}", file=sys.stderr)
        return 1
    if not labels_path.exists():
        print(f"Labels file not found: {labels_path}", file=sys.stderr)
        return 1

    data = json.loads(brain_path.read_text(encoding="utf-8"))
    if int(data.get("version", 0)) not in (3, 4):
        print("Expected brain JSON version 3 or 4.", file=sys.stderr)
        return 1

    memory = data.setdefault("memory", {})
    values = data.setdefault("values", {})

    for line in labels_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        h = row["position_hash"]
        m = row["move_uci"]
        w = int(row.get("weight", 10))
        reward = int(row.get("reward_if_not_bad", 3))
        penalize = bool(row.get("penalize", False))
        delta = -w if penalize else reward

        memory.setdefault(h, {})
        memory[h].setdefault(m, 0)
        memory[h][m] = int(memory[h][m]) + delta

        if args.also_values:
            alpha = 0.05
            target = -10.0 if penalize else 5.0
            old = float(values.get(h, 0))
            values[h] = old + alpha * (target - old)

    out_path = brain_path if args.in_place else Path(args.out or brain_path.with_name(brain_path.stem + "_merged.json"))
    if args.in_place:
        backup = brain_path.with_suffix(brain_path.suffix + ".bak")
        shutil.copy2(brain_path, backup)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote: {out_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
