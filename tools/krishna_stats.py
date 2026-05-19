#!/usr/bin/env python3
"""Aggregate self-play stats with Krishna-oriented heuristics."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def analyze(games_jsonl: Path) -> dict:
    games = 0
    plies_total = 0
    results = Counter()
    krishna_file_moves = 0  # moves on g-file (file index 6)
    total_moves = 0

    with games_jsonl.open(encoding="utf-8") as fp:
        for line in fp:
            if not line.strip():
                continue
            obj = json.loads(line)
            games += 1
            moves = obj.get("moves") or []
            plies_total += len(moves)
            results[obj.get("result", "*")] += 1
            for uci in moves:
                if len(uci) >= 1 and uci[0] == "g":
                    krishna_file_moves += 1
                total_moves += 1

    avg_plies = plies_total / games if games else 0
    draw_rate = results.get("1/2-1/2", 0) / games if games else 0

    metrics_path = ROOT / "models" / "metrics_v1.json"
    ml_metrics = {}
    if metrics_path.is_file():
        ml_metrics = json.loads(metrics_path.read_text(encoding="utf-8"))

    return {
        "games": games,
        "avg_plies": round(avg_plies, 2),
        "draw_rate": round(draw_rate, 4),
        "results": dict(results),
        "krishna_gfile_move_fraction": round(
            krishna_file_moves / max(total_moves, 1), 4
        ),
        "note": (
            "Krishna g-file proxy: UCI from g-file. "
            "Human-help stats require [HelpMoves] in saved PGNs."
        ),
        "ml_metrics": ml_metrics,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games-jsonl", required=True)
    ap.add_argument("--out-json", default="")
    ap.add_argument("--out-md", default="")
    args = ap.parse_args()

    data = analyze(Path(args.games_jsonl))

    if args.out_json:
        Path(args.out_json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out_json).write_text(json.dumps(data, indent=2), encoding="utf-8")

    if args.out_md:
        lines = [
            "# Training run summary",
            "",
            f"- Games: {data['games']}",
            f"- Avg plies: {data['avg_plies']}",
            f"- Draw rate: {data['draw_rate']}",
            f"- Results: {data['results']}",
            f"- Krishna g-file move fraction: {data['krishna_gfile_move_fraction']}",
            "",
            "## ML metrics",
            "```json",
            json.dumps(data.get("ml_metrics", {}), indent=2),
            "```",
            "",
            data.get("note", ""),
        ]
        Path(args.out_md).write_text("\n".join(lines), encoding="utf-8")

    print(json.dumps(data, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
