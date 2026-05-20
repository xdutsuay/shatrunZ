# ShatrunZ

**ShatrunZ** is a 9×9 chess variant platform: custom rules (including the uncapturable **Krishna** piece), a bundled C UCI engine, browser play UI, optional ML policy hints, and an admin dashboard for settings and training benchmarks.

This repository is the canonical home for the project—not a thin wrapper around another chess app.

## Quick start

```bash
git clone https://github.com/xdutsuay/shatrunZ.git
cd shatrunZ
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
make -C engine
./start.sh          # or: python start.py
```

Open **http://localhost:8000**

| Route | Mode |
|-------|------|
| `/pvp` | Human vs human |
| `/pvai` | Human vs AI (C engine and/or JS personas) |
| `/aivai` | AI vs AI with learning brains |
| `/admin` | Settings, persona stats, training-run history |

## What you get

- **Variant rules** — 9×9 board, standard pieces plus Krishna, promotion, and full legality in JS (`frontend/rules.js`, `frontend/game.js`) and C (`engine/`).
- **Play UI** — Dark, compact layout; live move list; PGN export; undo; step replay (`|<<` `◀` `▶` `>>|`); last-move highlight animation.
- **Clocks** — Total time + increment, configured in admin and enforced during play (paused on help, review, and training).
- **AI** — Material / Positional / Aggressive personas with persistent brain learning; optional C engine via `/api/engine-move`; PvAI autoplay hardened (timeouts, null-move handling, game-over detection).
- **Admin** — Central settings store, persona stats from brain data, list of `data/training_runs/` benchmark JSON.
- **ML (optional)** — Policy training from self-play; `/api/ml/policy-hint` for JS AI bonuses (`requirements-ml.txt`).

## Project layout

```
shatrunZ/
├── frontend/          # Play + admin UI (vanilla JS)
├── backend/           # Flask API and static serving
├── engine/            # C UCI engine + Python wrapper
├── scripts/           # Self-play, benchmarks, training helpers
├── tests-js/          # Node test runner (rules, modes, replay, fuzz)
├── tests/             # Python tests
├── data/              # Games, brains, training runs (gitignored where noted)
└── docs/              # Architecture, engine roles, roadmaps
```

## Tests

```bash
npm test                    # all JS tests (44+)
npm run test:fuzz           # 60s seeded rules fuzz + invariants
npm run test:perft          # apply/undo depth-2 sanity
pytest tests/ -q            # Python suite
```

## Training benchmark

Record engine throughput (calls/sec) for comparison across runs:

```bash
python scripts/train_benchmark_30m.py   # duration via env; see script header
```

Results land in `data/training_runs/` and appear on the admin page via `GET /api/training-runs`.

## Documentation

- [docs/START_HERE.md](docs/START_HERE.md) — minimal run guide  
- [docs/FEATURES.md](docs/FEATURES.md) — feature inventory  
- [docs/engine_roles.md](docs/engine_roles.md) — C engine vs JS vs external UCI  
- [docs/plans/](docs/plans/) — active implementation plans  
- [docs/ROADMAP_CHECKLIST.md](docs/ROADMAP_CHECKLIST.md) — shipped vs pending checklist  

## Upcoming

See [Releases](https://github.com/xdutsuay/shatrunZ/releases) for versioned changelogs. Planned next:

- **Strength benchmarks** — self-play quality metrics, not only throughput  
- **Variant-native engines** — Fairy-Stockfish / WASM path for stronger default AI  
- **Replay & PGN** — stricter round-trip and export edge cases  
- **UI polish** — smoother move transitions and review mode  
- **Engine depth** — quiescence, transposition table, optional NNUE-style eval  

## License

Engine and third-party components may carry their own licenses (see `docs/STOCKFISH.md`, `engine/third_party/`). Application code is maintained in this repo under the project’s stated terms.
