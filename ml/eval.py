#!/usr/bin/env python3
"""Evaluate policy net vs C-engine depth-4; write models/metrics_v1.json."""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _precision_recall(pred_set: set, true_set: set) -> tuple[float, float]:
    if not pred_set and not true_set:
        return 1.0, 1.0
    if not pred_set:
        return 0.0, 0.0
    if not true_set:
        return 0.0, 0.0
    tp = len(pred_set & true_set)
    prec = tp / len(pred_set)
    rec = tp / len(true_set)
    return prec, rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", type=str, default=str(ROOT / "models" / "policy_v1.pt"))
    ap.add_argument("--out", type=str, default=str(ROOT / "models" / "metrics_v1.json"))
    ap.add_argument("--games-jsonl", type=str, default="")
    ap.add_argument("--max-positions", type=int, default=50)
    args = ap.parse_args()

    metrics: dict = {
        "version": 1,
        "top1_accuracy": None,
        "top3_accuracy": None,
        "precision": None,
        "recall": None,
        "value_mae": None,
        "positions_evaluated": 0,
        "note": "",
    }

    ckpt = Path(args.checkpoint)
    engine_bin = ROOT / "engine" / "shatrunz_engine"

    try:
        import torch
        from ml.model import PolicyValueNet, move_to_index
        from ml.dataset import board_from_moves, tensor_from_board

        if not ckpt.is_file():
            metrics["note"] = "No checkpoint; run ml/train.py first"
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.out).write_text(json.dumps(metrics, indent=2), encoding="utf-8")
            print(json.dumps(metrics, indent=2))
            return 0

        data = torch.load(ckpt, map_location="cpu", weights_only=False)
        model = PolicyValueNet()
        model.load_state_dict(data["model"])
        model.eval()

        from engine.engine_wrapper import ShatrunZEngine

        if not engine_bin.is_file():
            metrics["note"] = "C engine not built"
            Path(args.out).write_text(json.dumps(metrics, indent=2), encoding="utf-8")
            return 0

        games_path = Path(args.games_jsonl) if args.games_jsonl else None
        if not games_path or not games_path.is_file():
            sp = sorted((ROOT / "data" / "selfplay").glob("run_*/games.jsonl"), reverse=True)
            games_path = sp[0] if sp else None

        positions: list[list[str]] = [[]]
        if games_path and games_path.is_file():
            with games_path.open(encoding="utf-8") as fp:
                for i, line in enumerate(fp):
                    if i >= 30:
                        break
                    obj = json.loads(line)
                    moves = obj.get("moves") or []
                    for d in range(0, min(len(moves), 20), 2):
                        positions.append(moves[:d])

        random.shuffle(positions)
        positions = positions[: args.max_positions]

        eng = ShatrunZEngine(str(engine_bin))
        top1 = top3 = 0
        prec_sum = rec_sum = 0.0
        n = 0
        try:
            for prefix in positions:
                try:
                    state = board_from_moves(prefix)
                except Exception:
                    continue
                planes = tensor_from_board(state["board"], state["turn"]).unsqueeze(0)
                with torch.no_grad():
                    logits, _ = model(planes)
                probs = torch.softmax(logits, dim=1)[0]
                top_idx = probs.argsort(descending=True)[:3].tolist()
                best_c = eng.get_best_move(moves=prefix, depth=4)
                if not best_c:
                    continue
                gt = move_to_index(best_c)
                if gt < 0:
                    continue
                if top_idx[0] == gt:
                    top1 += 1
                if gt in top_idx:
                    top3 += 1
                pred_set = {top_idx[0]}
                true_set = {gt}
                p, r = _precision_recall(pred_set, true_set)
                prec_sum += p
                rec_sum += r
                n += 1
        finally:
            eng.quit()

        if n > 0:
            metrics["top1_accuracy"] = round(top1 / n, 4)
            metrics["top3_accuracy"] = round(top3 / n, 4)
            metrics["precision"] = round(prec_sum / n, 4)
            metrics["recall"] = round(rec_sum / n, 4)
            metrics["positions_evaluated"] = n
        else:
            metrics["note"] = "No positions evaluated"
    except ImportError:
        metrics["note"] = "PyTorch not installed"

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
