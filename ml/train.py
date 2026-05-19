#!/usr/bin/env python3
"""Train policy_v1.pt from self-play JSONL (behavior cloning)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games-jsonl", type=str, required=True)
    ap.add_argument("--out", type=str, default=str(ROOT / "models" / "policy_v1.pt"))
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--max-games", type=int, default=100)
    ap.add_argument("--lr", type=float, default=1e-3)
    args = ap.parse_args()

    try:
        import torch
        import torch.nn.functional as F
        from torch.utils.data import DataLoader, TensorDataset
    except ImportError:
        print("PyTorch required: pip install torch", file=sys.stderr)
        return 1

    from ml.dataset import load_train_val
    from ml.model import PolicyValueNet

    games_path = Path(args.games_jsonl)
    if not games_path.is_file():
        print(f"Missing {games_path}", file=sys.stderr)
        return 1

    train_s, val_s = load_train_val(games_path, max_games=args.max_games)
    if len(train_s) < 10:
        print("Not enough training samples", file=sys.stderr)
        return 1

    def pack(samples):
        x = torch.stack([s["planes"] for s in samples])
        y = torch.tensor([s["policy_index"] for s in samples], dtype=torch.long)
        v = torch.tensor([s["value"] for s in samples], dtype=torch.float32)
        return TensorDataset(x, y, v)

    train_loader = DataLoader(pack(train_s), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(pack(val_s), batch_size=args.batch_size)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = PolicyValueNet().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)

    for epoch in range(args.epochs):
        model.train()
        loss_sum = 0.0
        n = 0
        for xb, yb, vb in train_loader:
            xb, yb, vb = xb.to(device), yb.to(device), vb.to(device)
            opt.zero_grad()
            logits, value = model(xb)
            loss_p = F.cross_entropy(logits, yb)
            loss_v = F.mse_loss(value, vb)
            loss = loss_p + 0.25 * loss_v
            loss.backward()
            opt.step()
            loss_sum += loss.item()
            n += 1
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for xb, yb, _vb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                logits, _ = model(xb)
                pred = logits.argmax(dim=1)
                correct += (pred == yb).sum().item()
                total += yb.size(0)
        acc = correct / max(total, 1)
        print(f"epoch {epoch + 1}/{args.epochs} loss={loss_sum / max(n, 1):.4f} val_top1={acc:.3f}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"model": model.state_dict(), "version": 1}, out_path)
    print(f"Saved {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
