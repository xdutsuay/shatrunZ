---
name: Plan 01 — Gameplay & reliability
overview: PvAI autoplay, API routing, AIvAI lockout, move navigation, clocks, and tests. Ship first; unblocks honest engine/API behavior on play pages.
todos:
  - id: p01-repro
    content: Reproduce PvAI no-start; note flags (help, C-engine, Start AI)
    status: pending
  - id: p01-help-ply0
    content: Fix auto-help firing ply0 when decision=null (help_signal + pvai)
    status: pending
  - id: p01-engine-timeout
    content: Add AbortController timeout + fallback on getEngineMove
    status: pending
  - id: p01-flask-order
    content: Register all /api/* before /<path:path> in server.py
    status: pending
  - id: p01-aivai-lock
    content: Lock strategy/level mid-game CVC; optional localStorage bypass
    status: pending
  - id: p01-live-nav
    content: LiveGameNavigator from uci list + review-ply guard (block moves/AI)
    status: pending
  - id: p01-nav-ui
    content: Add |<< < > >>| controls in play layout + style.css
    status: pending
  - id: p01-clocks
    content: ClockController total+increment; pause on help/training/review
    status: pending
  - id: p01-tests
    content: tests-js for help/timeout/nav/lock + clock increment math
    status: pending
  - id: p01-regression
    content: Run regression-guard on Plan 01 diff before merge
    status: pending
isProject: false
---

# Plan 01 — Gameplay & reliability

**Depends on:** nothing. **Feeds:** Plan 02 (admin reads same settings keys and training API).

## Scope

- [`frontend/modes/pvai.js`](../../frontend/modes/pvai.js), [`frontend/shared/help_signal.js`](../../frontend/shared/help_signal.js), [`frontend/api.js`](../../frontend/api.js)
- [`backend/server.py`](../../backend/server.py) route order
- [`frontend/modes/aivai.js`](../../frontend/modes/aivai.js) / [`frontend/ui.js`](../../frontend/ui.js) event wiring
- New small modules under `frontend/shared/` or `frontend/controllers/` for nav + clocks
- [`frontend/play.html`](../../frontend/play.html), [`frontend/style.css`](../../frontend/style.css)

## Hermes peer-review (summary)

- **Risk:** Catch-all swallowing `/api/*` if not reordered first — prioritize `p01-flask-order` early.
- **Risk:** Navigator + clocks share move timing; wire clock tick only when `viewPly === tipPly`.
- **Cut if late:** defer polish; keep nav + clocks minimal but correct.

## After code changes

Run `graphify update .` once per implementation session (repo rule).
