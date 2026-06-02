# ShatrunZ variant engine guide

9×9 ShatrunZ with the uncapturable **Krishna** (`z`) piece. This doc adapts standard chess-programming practice ([Chess Programming Wiki](https://www.chessprogramming.org/Main_Page)) to our variant.

## Board and rules

- 9×9 grid; piece values use centipawn scale (100 = one pawn) in JS and C.
- Krishna cannot be captured; move generation and eval must respect that.
- Pawn promotion, castling (if enabled), and repetition rules live in `frontend/rules.js` and `engine/`.

## Search (current + planned)

| Topic | Status |
|-------|--------|
| Alpha-beta | C: `engine/search.c` |
| Quiescence (captures at leaf) | C: implemented |
| Move ordering (captures first) | C + JS |
| Transposition table | Planned |
| Iterative deepening | Planned |
| Time management (`movetime`, clocks) | C UCI + API; JS depth from level |

## Evaluation

- Material + piece-square tables in C (`engine/evaluate.c`) and JS (`frontend/ai.js`).
- Persona brains add learned bonuses (`frontend/brain.js`).
- UI shows eval as **pawn units** (e.g. `+3.7` = +370 cp).

## Learning

- **Persona keys:** `persona_material`, `persona_positional`, `persona_aggressive`, `persona_c_native` (one stats bucket per engine, not per color).
- Storage: browser `localStorage`; optional server mirror under `data/brains/`.
- Hyper-train rotates strategy pairs and writes to the same persona keys.

## Opening book (planned)

- Extend `frontend/shared/opening_book.js` with variant lines.
- Mirror critical lines in a small C book file for engine parity.

## Tablebase (planned — 9 pieces)

Standard Syzygy is 7-piece max on 8×8. For ShatrunZ:

- Scope: endgames with ≤ 9 **variant** pieces (including Krishna constraints).
- Generation pipeline TBD (custom generator or adapted fairy tools).
- Probe hook at `game_phases` endgame threshold.

## Multi-language engines (future)

1. **Go** reference implementation for fast iteration and tests.
2. Golden positions shared with C via JSON fixtures.
3. Optional Rust/Mojo ports sharing the same test vectors.

## Pondering

Engines idle on the opponent’s turn unless UCI `go ponder` is implemented. Not enabled in v0.4.x play UI.

## Testing

- `npm test` — JS rules, personas, modes.
- `make -C engine` + `tests/engine_mate_in_1.sh` — C tactical smoke.
- `pytest tests/` — backend API contracts.
