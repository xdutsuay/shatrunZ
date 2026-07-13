# ShatrunZ roadmap (split)

The original single overhaul plan is split for faster execution:

| Plan | File | Focus |
|------|------|--------|
| **01** | [PLAN_01_gameplay_reliability.md](./PLAN_01_gameplay_reliability.md) | PvAI, Flask `/api` order, AIvAI lock, move nav, clocks, tests |
| **02** | [PLAN_02_admin_training.md](./PLAN_02_admin_training.md) | Settings store, `/admin`, training runs + 30m benchmark, polish |
| **03** | [PLAN_03_rust_port.md](./PLAN_03_rust_port.md) | Full Rust port: core→WASM, Rust UCI engine, axum server, ShatrunZ MCP; multi-session milestones + parity gates |

**10 todos each (20 total)** for plans 01–02; do Plan 01 first (Plan 02 assumes stable API routing). Plan 03 is the standalone Rust-port roadmap, developed on branch `claude/rust-port-bl0o62`.

Hermes one-shot peer review log: [`../hermes-logs/hermes-oneshot.log`](../../hermes-logs/hermes-oneshot.log) (repo root).
