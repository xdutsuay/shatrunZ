#!/usr/bin/env python3
"""Export policy_v1.pt to ONNX for browser inference."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", type=str, default=str(ROOT / "models" / "policy_v1.pt"))
    ap.add_argument("--out", type=str, default=str(ROOT / "models" / "policy_v1.onnx"))
    args = ap.parse_args()

    try:
        import torch
    except ImportError:
        print("PyTorch required", file=sys.stderr)
        return 1

    from ml.model import PolicyValueNet

    ckpt = Path(args.checkpoint)
    if not ckpt.is_file():
        print(f"Missing {ckpt}", file=sys.stderr)
        return 1

    data = torch.load(ckpt, map_location="cpu", weights_only=False)
    model = PolicyValueNet()
    model.load_state_dict(data["model"])
    model.eval()

    dummy = torch.zeros(1, 16, 9, 9)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model,
        dummy,
        str(out_path),
        input_names=["board"],
        output_names=["policy_logits", "value"],
        dynamic_axes={"board": {0: "batch"}},
        opset_version=17,
    )
    print(f"Exported {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
