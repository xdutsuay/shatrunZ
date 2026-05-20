---
name: Plan 02 — Admin & training metrics
overview: Central settings, /admin UI with persona stats and training-run history, 30m benchmark artifact + API, layout polish. Build settings shell before charts (avoids empty admin reading half-built store).
todos:
  - id: p02-settings-store
    content: Add settings_store.js (defaults + localStorage read/write API)
    status: pending
  - id: p02-admin-route
    content: Flask /admin + admin.html + admin_main.js + main.js path hook
    status: pending
  - id: p02-persona-table
    content: Admin table of brain stats per persona key (read localStorage)
    status: pending
  - id: p02-play-wire-settings
    content: Point play page toggles at settings_store keys
    status: pending
  - id: p02-train-dir
    content: Write run JSON/JSONL under data/training_runs/ from benchmark
    status: pending
  - id: p02-api-runs
    content: GET /api/training-runs listing + safe path filter
    status: pending
  - id: p02-benchmark-30m
    content: scripts/train_benchmark_30m.py wall-clock loop + docs one-liner
    status: pending
  - id: p02-admin-charts
    content: Admin runs table + simple chart/sparkline from API JSON
    status: pending
  - id: p02-ui-polish
    content: Lichess-inspired dark panels/compact chrome (play + admin)
    status: pending
  - id: p02-tracker
    content: Linear issues optional else docs/ROADMAP_CHECKLIST.md mirror
    status: pending
isProject: false
---

# Plan 02 — Admin & training metrics

**Prerequisite:** Plan 01 Flask route order (so new `/api/training-runs` is never shadowed).

## Order note (Hermes)

Implement **settings_store** and **admin shell** before heavy training charts so the admin page always has stable keys to read/write.

## Scope

- [`backend/server.py`](../../backend/server.py): `/admin`, `/api/training-runs`
- [`frontend/admin.html`](../../frontend/admin.html), [`frontend/admin_main.js`](../../frontend/admin_main.js), [`frontend/main.js`](../../frontend/main.js)
- [`scripts/`](../../scripts/) benchmark script; [`data/training_runs/`](../../data/training_runs/) (gitignore if needed)
- [`frontend/brain.js`](../../frontend/brain.js) naming conventions for persona keys

## Cuts if time-boxed

- Skip fancy charts → table-only first run.
- Defer graphify to post-MVP (optional; still run after large refactors if time).

## After code changes

Run `graphify update .` once per implementation session (repo rule).
