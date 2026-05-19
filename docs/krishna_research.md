# Krishna research (ShatrunZ variant)

## Design intent

Krishna (`Z`/`z`) is the Mahabharata-inspired piece: **cannot capture**, **cannot be captured**, **does not give check**, but **blocks lines** like a normal occupant. See [rules.md](rules.md).

The variant exists to study how this piece changes strategy—not standard chess with an extra piece.

## Stability gate (before strong claims)

1. Undo + PGN + `[HelpMoves]` provenance work.
2. JS vs C legal parity on shallow walks (≤12 plies).
3. Self-play + one 10-minute train cycle with published `train_report_*.json`.
4. Only then compare win rates / Krishna advancement heuristics at scale.

## Metrics (v1)

| Metric | Source |
|--------|--------|
| Avg plies, draw rate | `tools/krishna_stats.py` on `games.jsonl` |
| Krishna g-file move fraction | Proxy: UCI moves starting on `g` (starting file) |
| Human-help plies | `[HelpMoves]` tag in saved PGN |
| ML top-1 / precision / recall | `models/metrics_v1.json` after `ml/eval.py` |

## Hypotheses to test later

- Krishna advanced off g-file correlates with longer games (blocking center).
- Games without Krishna trades (impossible by capture) have fewer decisive endings by material.
- Help-assisted AI moves differ in opening vs endgame phase distribution.

## Commands

```bash
bash scripts/train_10min.sh
cat models/train_report_*.md
```
