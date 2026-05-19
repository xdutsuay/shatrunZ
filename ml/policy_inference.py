"""Optional PyTorch policy inference for backend API."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def policy_bonuses_for_position(uci_prefix: list[str], legal_uci: list[str]) -> dict[str, float]:
    """
    Return moveStr -> bonus for legal UCI moves at position after uci_prefix.
    Empty dict if model unavailable.
    """
    try:
        import torch
    except ImportError:
        return {}

    ckpt = ROOT / "models" / "policy_v1.pt"
    if not ckpt.is_file():
        return {}

    from ml.dataset import board_from_moves, tensor_from_board
    from ml.model import PolicyValueNet, move_to_index

    try:
        state = board_from_moves(uci_prefix)
        planes = tensor_from_board(state["board"], state["turn"]).unsqueeze(0)
    except Exception:
        return {}

    data = torch.load(ckpt, map_location="cpu", weights_only=False)
    model = PolicyValueNet()
    model.load_state_dict(data["model"])
    model.eval()

    with torch.no_grad():
        logits, _ = model(planes)
        probs = torch.softmax(logits, dim=1)[0]

    bonuses: dict[str, float] = {}
    for uci in legal_uci:
        idx = move_to_index(uci)
        if idx >= 0 and idx < probs.shape[0]:
            bonuses[uci] = float(probs[idx].item()) * 10.0
    return bonuses
