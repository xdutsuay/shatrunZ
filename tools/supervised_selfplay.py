#!/usr/bin/env python3
"""
Optional slow supervised lane (interactive engine games).

High-throughput training uses `tools/selfplay.py` (no human in the loop). For
human yes/no feedback on positions, use the offline pipeline:

  1) node tools/js/emit_insights.mjs --games-jsonl data/selfplay/run_*/games.jsonl
  2) python tools/review_insights.py --pending data/insights/pending_insights.ndjson
  3) python tools/merge_feedback_into_brain.py --brain your_export.json --labels data/insights/approved_labels.ndjson --out brain_merged.json

A future version could pause `tools/selfplay.py` each ply for stdin; that is
intentionally not the default because it destroys games/sec.
"""
from __future__ import annotations

if __name__ == "__main__":
    print(__doc__)
