from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
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
    for ply in range(max_plies):
        is_white = (ply % 2 == 0)
        eng = eng_w if is_white else eng_b
        cfg = cfg_w if is_white else cfg_b

        mv = eng.get_best_move(moves=moves, depth=cfg.depth, randomness=cfg.randomness)
        if not mv or mv == "0000":
            winner = "black" if is_white else "white"
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
    html_path = out_dir / "report.html"
    labels = [p["game"] for p in points]
    series = {}
    for p in points:
        for k, v in p["elo"].items():
            series.setdefault(k, []).append(v)

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
        legend_items.append(
            f'<div><span style="display:inline-block;width:10px;height:10px;background:{color};'
            f'border-radius:2px;margin-right:8px;"></span>{name}</div>'
        )

    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ShatrunZ Selfplay Report</title>
</head>
<body>
  <h2>Self-play Elo (online estimate)</h2>
  <p>Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
  <svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">
    {''.join(paths)}
  </svg>
  {''.join(legend_items)}
</body>
</html>
"""
    html_path.write_text(html, encoding="utf-8")


def _config_to_dict(cfg: EngineConfig) -> dict[str, Any]:
    return {
        "name": cfg.name,
        "engine_path": cfg.engine_path,
        "init_commands": cfg.init_commands,
        "depth": cfg.depth,
        "randomness": cfg.randomness,
    }


def _config_from_dict(d: dict[str, Any]) -> EngineConfig:
    return EngineConfig(**d)


def _worker_run_batch(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Run a batch of games in a worker process (own engine subprocesses)."""
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    specs: list[dict[str, Any]] = payload["specs"]
    configs = [_config_from_dict(c) for c in payload["configs"]]
    max_plies = payload["max_plies"]
    seed = payload["seed"]

    random.seed(seed)
    engines = {c.name: ShatrunZEngine(c.engine_path, init_commands=c.init_commands) for c in configs}
    cfg_by_name = {c.name: c for c in configs}
    out: list[dict[str, Any]] = []

    try:
        for spec in specs:
            cfg_w = cfg_by_name[spec["white"]]
            cfg_bl = cfg_by_name[spec["black"]]
            game_out = play_one_game(
                engines[cfg_w.name],
                engines[cfg_bl.name],
                cfg_w,
                cfg_bl,
                max_plies=max_plies,
            )
            out.append({
                "game": spec["game"],
                "white": cfg_w.name,
                "black": cfg_bl.name,
                "white_cfg": {"depth": cfg_w.depth, "randomness": cfg_w.randomness},
                "black_cfg": {"depth": cfg_bl.depth, "randomness": cfg_bl.randomness},
                **game_out,
            })
    finally:
        for e in engines.values():
            e.quit()

    return out


def _build_game_specs(
    games: int,
    pairings: list[tuple[EngineConfig, EngineConfig]],
    seed: int,
) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    specs = []
    for g in range(1, games + 1):
        cfg_a, cfg_b = rng.choice(pairings)
        if g % 2 == 0:
            cfg_w, cfg_bl = cfg_a, cfg_b
        else:
            cfg_w, cfg_bl = cfg_b, cfg_a
        specs.append({"game": g, "white": cfg_w.name, "black": cfg_bl.name})
    return specs


def _chunk_specs(specs: list[dict[str, Any]], workers: int) -> list[list[dict[str, Any]]]:
    chunks: list[list[dict[str, Any]]] = [[] for _ in range(workers)]
    for i, spec in enumerate(specs):
        chunks[i % workers].append(spec)
    return [c for c in chunks if c]


def _update_elo_from_game(
    elo: dict[str, float],
    results: dict[str, dict[str, int]],
    cfg_w_name: str,
    cfg_bl_name: str,
    result: str,
    k: float,
) -> float:
    if result == "1-0":
        s_w = 1.0
        results["wins"][cfg_w_name] += 1
        results["losses"][cfg_bl_name] += 1
    elif result == "0-1":
        s_w = 0.0
        results["wins"][cfg_bl_name] += 1
        results["losses"][cfg_w_name] += 1
    else:
        s_w = 0.5
        results["draws"][cfg_w_name] += 1
        results["draws"][cfg_bl_name] += 1
    elo[cfg_w_name], elo[cfg_bl_name] = elo_update(elo[cfg_w_name], elo[cfg_bl_name], s_w, k)
    return s_w


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=25000)
    ap.add_argument("--max-plies", type=int, default=220)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", type=str, default="")
    ap.add_argument("--report-every", type=int, default=50, help="Rewrite report.html every N games (0 disables).")
    ap.add_argument(
        "--workers",
        type=int,
        default=max(1, (os.cpu_count() or 2) - 1),
        help="Parallel worker processes (1 = serial).",
    )
    ap.add_argument(
        "--duration-sec",
        type=int,
        default=0,
        help="Stop after this many seconds (wall clock). 0 = run all --games.",
    )
    args = ap.parse_args()

    root = ROOT
    out_dir = Path(args.out) if args.out else (root / "data" / "selfplay" / time.strftime("run_%Y%m%d_%H%M%S"))
    safe_mkdir(out_dir)

    engine_path = str(root / "engine" / "shatrunz_engine")
    configs = [
        EngineConfig("c_depth3", engine_path, [], depth=3, randomness=0),
        EngineConfig("c_depth3_rand", engine_path, [], depth=3, randomness=40),
        EngineConfig("c_depth4", engine_path, [], depth=4, randomness=0),
    ]

    elo = {c.name: 1500.0 for c in configs}
    k = 16.0
    games_path = out_dir / "games.jsonl"
    elo_path = out_dir / "elo_points.json"
    summary_path = out_dir / "summary.json"

    pairings = []
    for i in range(len(configs)):
        for j in range(i + 1, len(configs)):
            pairings.append((configs[i], configs[j]))

    results = {
        "wins": {c.name: 0 for c in configs},
        "losses": {c.name: 0 for c in configs},
        "draws": {c.name: 0 for c in configs},
    }

    elo_points: list[dict[str, Any]] = []
    t0 = time.time()
    deadline = (t0 + args.duration_sec) if args.duration_sec > 0 else None
    workers = max(1, args.workers)
    config_dicts = [_config_to_dict(c) for c in configs]
    games_played = 0
    rng = random.Random(args.seed)

    def timed_out() -> bool:
        return deadline is not None and time.time() >= deadline

    def record_game(fp, record: dict[str, Any]) -> None:
        nonlocal games_played
        _update_elo_from_game(
            elo, results, record["white"], record["black"], record["result"], k
        )
        write_jsonl_line(fp, record)
        games_played += 1
        g = record["game"]
        if g % 50 == 0:
            elo_points.append({"game": g, "elo": {n: round(v, 2) for n, v in elo.items()}})
            elo_path.write_text(json.dumps(elo_points, indent=2), encoding="utf-8")
            if args.report_every and (g % args.report_every == 0):
                render_simple_report(out_dir, elo_points)

    with games_path.open("a", encoding="utf-8") as fp:
        if workers == 1:
            engines = {c.name: ShatrunZEngine(c.engine_path, init_commands=c.init_commands) for c in configs}
            cfg_by_name = {c.name: c for c in configs}
            try:
                g = 0
                while g < args.games and not timed_out():
                    g += 1
                    cfg_a, cfg_b = rng.choice(pairings)
                    cfg_w, cfg_bl = (cfg_a, cfg_b) if g % 2 == 0 else (cfg_b, cfg_a)
                    game_out = play_one_game(
                        engines[cfg_w.name],
                        engines[cfg_bl.name],
                        cfg_w,
                        cfg_bl,
                        max_plies=args.max_plies,
                    )
                    record = {
                        "game": g,
                        "white": cfg_w.name,
                        "black": cfg_bl.name,
                        "white_cfg": {"depth": cfg_w.depth, "randomness": cfg_w.randomness},
                        "black_cfg": {"depth": cfg_bl.depth, "randomness": cfg_bl.randomness},
                        **game_out,
                    }
                    record_game(fp, record)
            finally:
                for e in engines.values():
                    e.quit()
        else:
            g = 0
            wave = 0
            while g < args.games and not timed_out():
                wave += 1
                batch_n = min(workers * 4, args.games - g)
                specs = []
                for _ in range(batch_n):
                    g += 1
                    cfg_a, cfg_b = rng.choice(pairings)
                    cfg_w, cfg_bl = (cfg_a, cfg_b) if g % 2 == 0 else (cfg_b, cfg_a)
                    specs.append({"game": g, "white": cfg_w.name, "black": cfg_bl.name})
                chunks = _chunk_specs(specs, workers)
                payloads = [
                    {
                        "specs": chunk,
                        "configs": config_dicts,
                        "max_plies": args.max_plies,
                        "seed": args.seed + wave * 10007,
                    }
                    for idx, chunk in enumerate(chunks)
                ]
                completed: list[dict[str, Any]] = []
                with ProcessPoolExecutor(max_workers=len(chunks)) as pool:
                    futures = [pool.submit(_worker_run_batch, p) for p in payloads]
                    for fut in as_completed(futures):
                        completed.extend(fut.result())
                completed.sort(key=lambda r: r["game"])
                for record in completed:
                    record_game(fp, record)

    elapsed = time.time() - t0
    rate = games_played / max(elapsed, 1e-9)

    summary_path.write_text(
        json.dumps(
            {
                "games": games_played,
                "games_requested": args.games,
                "duration_sec": args.duration_sec,
                "workers": workers,
                "configs": [c.__dict__ for c in configs],
                "elo": elo,
                "results": results,
                "rate_games_per_sec": round(rate, 3),
                "out_dir": str(out_dir),
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    render_simple_report(
        out_dir,
        elo_points or [{"game": games_played, "elo": {n: round(v, 2) for n, v in elo.items()}}],
    )
    print(
        f"Self-play: {games_played} games in {elapsed:.1f}s "
        f"({rate:.2f} games/sec) workers={workers}"
        + (f" duration_limit={args.duration_sec}s" if args.duration_sec else "")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
