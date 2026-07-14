//! Two independent search algorithms exist per docs/RUST_PORT.md "Search":
//! `persona` mirrors `frontend/ai.js` (unordered negamax, captures-only
//! quiescence, no mate scoring); `engine` mirrors `engine/search.c`
//! (capture-first ordering, quiescence with checks, proper mate scores),
//! built on `engine_position` (the C-specific move generator ported in
//! M4 — rights-mode castling, underpromotion, and two confirmed bugs
//! inherited transitively into this search).

pub mod engine;
pub mod persona;
