"""Small conv policy-value net for 9x9 ShatrunZ."""

from __future__ import annotations

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except ImportError:  # pragma: no cover
    torch = None
    nn = None
    F = None

BOARD = 9
NUM_PLANES = 16
POLICY_SIZE = BOARD * BOARD * BOARD * BOARD  # 9^4 = 6561


def move_to_index(uci: str) -> int:
    files = "abcdefghi"
    if len(uci) < 4:
        return -1
    fc, fr, tc, tr = files.index(uci[0]), int(uci[1]), files.index(uci[2]), int(uci[3])
    fr_i, tr_i = 9 - fr, 9 - tr
    return ((fr_i * 9 + fc) * 9 + tr_i) * 9 + tc


def index_to_uci(idx: int) -> str:
    files = "abcdefghi"
    tc = idx % 9
    idx //= 9
    tr_i = idx % 9
    idx //= 9
    fc = idx % 9
    fr_i = idx // 9
    return f"{files[fc]}{9 - fr_i}{files[tc]}{9 - tr_i}"


if torch is not None:

    class ResBlock(nn.Module):
        def __init__(self, channels: int = 64):
            super().__init__()
            self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
            self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)

        def forward(self, x):
            r = x
            x = F.relu(self.conv1(x))
            x = self.conv2(x)
            return F.relu(x + r)

    class PolicyValueNet(nn.Module):
        def __init__(self, planes: int = NUM_PLANES, channels: int = 64):
            super().__init__()
            self.stem = nn.Conv2d(planes, channels, 3, padding=1)
            self.blocks = nn.Sequential(*[ResBlock(channels) for _ in range(4)])
            self.policy_head = nn.Conv2d(channels, 2, 1)
            self.policy_fc = nn.Linear(2 * BOARD * BOARD, POLICY_SIZE)
            self.value_head = nn.Conv2d(channels, 1, 1)
            self.value_fc1 = nn.Linear(BOARD * BOARD, 64)
            self.value_fc2 = nn.Linear(64, 1)

        def forward(self, x):
            x = F.relu(self.stem(x))
            x = self.blocks(x)
            p = F.relu(self.policy_head(x))
            p = p.view(p.size(0), -1)
            policy_logits = self.policy_fc(p)
            v = F.relu(self.value_head(x))
            v = v.view(v.size(0), -1)
            v = F.relu(self.value_fc1(v))
            value = torch.tanh(self.value_fc2(v))
            return policy_logits, value.squeeze(-1)

else:
    PolicyValueNet = None  # type: ignore
