## Overhaul checklist (mirrors Plan 01 + 02)

### Plan 01 — Gameplay & reliability

- [x] PvAI repro and root cause identified.
- [x] Fix input blocking in PvAI to not block human when autoRunning but it is still human turn.
- [x] Add engine move timeout (fetch abort) so “Thinking…” does not hang forever.
- [x] Reorder Flask routes so `/api/*` are registered before the static catch-all.
- [x] Prevent AIvAI persona / level changes mid-game unless an admin toggle is enabled.
- [x] Add move navigation buttons (|<< < > >>|) and live review mode guard.
- [x] Add clocks (total + increment) controlled via admin settings.
- [x] Add/adjust targeted tests for mode logic + clock controller.

### Plan 02 — Admin & training

- [x] Add `frontend/shared/settings_store.js` for centralized settings keys.
- [x] Add `/admin` page and route (`frontend/admin.html`, `frontend/admin_main.js`).
- [x] Admin shows persona stats from brain localStorage `_stats`.
- [x] Play page toggles wired to settings store for Help + Auto-help.
- [x] Ignore `data/training_runs/` in git.
- [x] Add `/api/training-runs` to list prior run files.
- [x] Add `scripts/train_benchmark_30m.py` (env-configurable).
- [x] Admin lists training runs (table-first).
- [x] Light admin styling polish.
- [ ] Linear: create project + issues (auth required; skipped if not authorized).

