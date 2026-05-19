"""Build tensors from self-play JSONL (behavior cloning)."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Iterator

from ml.model import NUM_PLANES, move_to_index

PIECE_PLANE = {
    ("w", "p"): 0, ("w", "n"): 1, ("w", "b"): 2, ("w", "r"): 3,
    ("w", "q"): 4, ("w", "k"): 5, ("w", "z"): 6,
    ("b", "p"): 7, ("b", "n"): 8, ("b", "b"): 9, ("b", "r"): 10,
    ("b", "q"): 11, ("b", "k"): 12, ("b", "z"): 13,
}


def board_from_moves(moves: list[str]) -> list[list[dict | None]]:
    """Replay UCI on a minimal 9x9 board via Node (authoritative rules)."""
    import subprocess
    import sys

    root = Path(__file__).resolve().parent.parent
    script = (
        "import { Game } from './frontend/game.js';"
        "import { parseUCIMove } from './frontend/shared/uci.js';"
        "const g=new Game();"
        "for(const u of process.argv.slice(2)){const p=parseUCIMove(u);g.executeMove(p.from,p.to);}"
        "const out=[];"
        "for(let r=0;r<9;r++){const row=[];for(let c=0;c<9;c++){"
        "const p=g.board[r][c];row.push(p?{c:p.color,t:p.type}:null);}out.push(row);}"
        "console.log(JSON.stringify({board:out,turn:g.turn}));"
    )
    r = subprocess.run(
        ["node", "--input-type=module", "-e", script, *moves],
        cwd=str(root),
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(r.stdout)


def tensor_from_board(board: list[list[dict | None]], turn: str):
    import torch

    planes = torch.zeros(NUM_PLANES, 9, 9)
    for r in range(9):
        for c in range(9):
            p = board[r][c]
            if not p:
                continue
            idx = PIECE_PLANE.get((p["c"], p["t"]))
            if idx is not None:
                planes[idx, r, c] = 1.0
    planes[14, :, :] = 1.0 if turn == "w" else 0.0
    return planes


def iter_samples(games_jsonl: Path, max_games: int = 500) -> Iterator[dict]:
    count = 0
    with games_jsonl.open(encoding="utf-8") as fp:
        for line in fp:
            if count >= max_games:
                break
            obj = json.loads(line)
            moves = obj.get("moves") or []
            result = obj.get("result", "1/2-1/2")
            target_value = 1.0 if result == "1-0" else (-1.0 if result == "0-1" else 0.0)
            prefix: list[str] = []
            for uci in moves:
                try:
                    state = board_from_moves(prefix)
                    board = state["board"]
                    turn = state["turn"]
                except Exception:
                    break
                idx = move_to_index(uci)
                if idx < 0:
                    break
                yield {
                    "planes": tensor_from_board(board, turn),
                    "policy_index": idx,
                    "value": target_value,
                }
                prefix.append(uci)
            count += 1


def load_train_val(games_jsonl: Path, val_frac: float = 0.1, max_games: int = 200):
    samples = list(iter_samples(games_jsonl, max_games=max_games))
    random.shuffle(samples)
    n_val = max(1, int(len(samples) * val_frac))
    return samples[n_val:], samples[:n_val]
