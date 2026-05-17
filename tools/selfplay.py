from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.engine_wrapper import ShatrunZEngine


@dataclass(frozen=True)
class EngineConfig:
    name: str
    engine_path: str
    init_commands: list[str]
    depth: int
    randomness: int


def elo_expected(r_a: float, r_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((r_b - r_a) / 400.0))


def elo_update(r_a: float, r_b: float, score_a: float, k: float) -> tuple[float, float]:
    e_a = elo_expected(r_a, r_b)
    delta = k * (score_a - e_a)
    return r_a + delta, r_b - delta


def safe_mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def write_jsonl_line(fp, obj: dict[str, Any]) -> None:
    fp.write(json.dumps(obj, ensure_ascii=False) + "\n")


def play_one_game(
    eng_w: ShatrunZEngine,
    eng_b: ShatrunZEngine,
    cfg_w: EngineConfig,
    cfg_b: EngineConfig,
    max_plies: int,
) -> dict[str, Any]:
    moves: list[str] = []
    # We rely on engine legality; game ends when engine returns 0000 or None.
    for ply in range(max_plies):
        is_white = (ply % 2 == 0)
        eng = eng_w if is_white else eng_b
        cfg = cfg_w if is_white else cfg_b

        mv = eng.get_best_move(moves=moves, depth=cfg.depth, randomness=cfg.randomness)
        if not mv or mv == "0000":
            # No legal moves for side to move.
            winner = "black" if is_white else "white"
            # We can't distinguish mate/stalemate without a rules engine here; mark as terminal.
            result = "0-1" if winner == "black" else "1-0"
            return {
                "result": result,
                "terminal": True,
                "plies": ply,
                "moves": moves,
            }

        moves.append(mv)

    return {
        "result": "1/2-1/2",
        "terminal": False,
        "plies": max_plies,
        "moves": moves,
    }


def render_simple_report(out_dir: Path, points: list[dict[str, Any]]) -> None:
    # Small self-contained HTML report with inline SVG.
    html_path = out_dir / "report.html"
    labels = [p["game"] for p in points]
    series = {}
    for p in points:
        for k, v in p["elo"].items():
            series.setdefault(k, []).append(v)

    # Normalize x/y for svg
    w, h = 980, 420
    pad = 40
    all_vals = [v for arr in series.values() for v in arr]
    if not all_vals:
        return
    y_min = min(all_vals)
    y_max = max(all_vals)
    if y_max == y_min:
        y_max += 1

    def sx(i: int) -> float:
        if len(labels) <= 1:
            return pad
        return pad + (w - 2 * pad) * (i / (len(labels) - 1))

    def sy(v: float) -> float:
        return pad + (h - 2 * pad) * (1 - (v - y_min) / (y_max - y_min))

    colors = ["#4aa3ff", "#3bb273", "#d65252", "#bf811d", "#c9c8c6"]
    paths = []
    legend_items = []
    for idx, (name, vals) in enumerate(sorted(series.items())):
        pts = " ".join(f"{sx(i):.2f},{sy(v):.2f}" for i, v in enumerate(vals))
        color = colors[idx % len(colors)]
        paths.append(f'<polyline fill="none" stroke="{color}" stroke-width="2" points="{pts}"/>')
        legend_items.append(f'<div><span style="display:inline-block;width:10px;height:10px;background:{color};border-radius:2px;margin-right:8px;"></span>{name}</div>')

    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ShatrunZ Selfplay Report</title>
  <style>
    body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 20px; color: #222; }}
    .row {{ display:flex; gap: 18px; flex-wrap: wrap; }}
    .card {{ border: 1px solid #ddd; border-radius: 10px; padding: 14px 16px; }}
    .legend {{ font-size: 14px; line-height: 1.7; }}
    .muted {{ color: #666; font-size: 13px; }}
  </style>
</head>
<body>
  <h2>Self-play Elo (online estimate)</h2>
  <div class="muted">Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}</div>
  <div class="row" style="margin-top:14px;">
    <div class="card">
      <svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="Elo chart">
        <rect x="0" y="0" width="{w}" height="{h}" fill="#fff"/>
        <line x1="{pad}" y1="{h-pad}" x2="{w-pad}" y2="{h-pad}" stroke="#bbb"/>
        <line x1="{pad}" y1="{pad}" x2="{pad}" y2="{h-pad}" stroke="#bbb"/>
        {''.join(paths)}
      </svg>
    </div>
    <div class="card legend">
      <div><strong>Engines</strong></div>
      {''.join(legend_items)}
      <div style="margin-top:12px;" class="muted">Range: {y_min:.1f} – {y_max:.1f}</div>
    </div>
  </div>
</body>
</html>
"""
    html_path.write_text(html, encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=25000)
    ap.add_argument("--max-plies", type=int, default=220)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", type=str, default="")
    ap.add_argument("--report-every", type=int, default=50, help="Rewrite report.html every N games (0 disables).")
    args = ap.parse_args()

    random.seed(args.seed)

    root = Path(__file__).resolve().parent.parent
    out_dir = Path(args.out) if args.out else (root / "data" / "selfplay" / time.strftime("run_%Y%m%d_%H%M%S"))
    safe_mkdir(out_dir)

    engine_path = str(root / "engine" / "shatrunz_engine")
    # 3 “personalities” purely via depth + randomness (fast and works today).
    configs = [
        EngineConfig("c_depth3", engine_path, [], depth=3, randomness=0),
        EngineConfig("c_depth3_rand", engine_path, [], depth=3, randomness=40),
        EngineConfig("c_depth4", engine_path, [], depth=4, randomness=0),
    ]

    # Persistent Elo state
    elo = {c.name: 1500.0 for c in configs}
    k = 16.0

    games_path = out_dir / "games.jsonl"
    elo_path = out_dir / "elo_points.json"
    summary_path = out_dir / "summary.json"

    # Round-robin schedule
    pairings = []
    for i in range(len(configs)):
        for j in range(i + 1, len(configs)):
            pairings.append((configs[i], configs[j]))

    # Start engines once (fast)
    engines = {}
    for cfg in configs:
        engines[cfg.name] = ShatrunZEngine(cfg.engine_path, init_commands=cfg.init_commands)

    results = {
        "wins": {c.name: 0 for c in configs},
        "losses": {c.name: 0 for c in configs},
        "draws": {c.name: 0 for c in configs},
    }

    elo_points: list[dict[str, Any]] = []
    t0 = time.time()

    with games_path.open("a", encoding="utf-8") as fp:
        for g in range(1, args.games + 1):
            cfg_a, cfg_b = random.choice(pairings)
            # Alternate colors
            if g % 2 == 0:
                cfg_w, cfg_bl = cfg_a, cfg_b
            else:
                cfg_w, cfg_bl = cfg_b, cfg_a

            eng_w = engines[cfg_w.name]
            eng_b = engines[cfg_bl.name]

            game_out = play_one_game(eng_w, eng_b, cfg_w, cfg_bl, max_plies=args.max_plies)

            # Score for white
            if game_out["result"] == "1-0":
                s_w = 1.0
                results["wins"][cfg_w.name] += 1
                results["losses"][cfg_bl.name] += 1
            elif game_out["result"] == "0-1":
                s_w = 0.0
                results["wins"][cfg_bl.name] += 1
                results["losses"][cfg_w.name] += 1
            else:
                s_w = 0.5
                results["draws"][cfg_w.name] += 1
                results["draws"][cfg_bl.name] += 1

            elo[cfg_w.name], elo[cfg_bl.name] = elo_update(elo[cfg_w.name], elo[cfg_bl.name], s_w, k)

            write_jsonl_line(fp, {
                "game": g,
                "white": cfg_w.name,
                "black": cfg_bl.name,
                "white_cfg": {"depth": cfg_w.depth, "randomness": cfg_w.randomness},
                "black_cfg": {"depth": cfg_bl.depth, "randomness": cfg_bl.randomness},
                **game_out,
            })

            if g % 50 == 0:
                elo_points.append({"game": g, "elo": {k: round(v, 2) for k, v in elo.items()}})
                elo_path.write_text(json.dumps(elo_points, indent=2), encoding="utf-8")
                if args.report_every and (g % args.report_every == 0):
                    render_simple_report(out_dir, elo_points)

            if g % 500 == 0:
                elapsed = time.time() - t0
                rate = g / max(elapsed, 1e-9)
                summary_path.write_text(json.dumps({
                    "games": g,
                    "configs": [c.__dict__ for c in configs],
                    "elo": elo,
                    "results": results,
                    "rate_games_per_sec": rate,
                    "out_dir": str(out_dir),
                }, indent=2), encoding="utf-8")

    # Finalize
    for e in engines.values():
        e.quit()

    summary_path.write_text(json.dumps({
        "games": args.games,
        "configs": [c.__dict__ for c in configs],
        "elo": elo,
        "results": results,
        "out_dir": str(out_dir),
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }, indent=2), encoding="utf-8")

    render_simple_report(out_dir, elo_points or [{"game": args.games, "elo": {k: round(v, 2) for k, v in elo.items()}}])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

