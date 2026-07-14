//! Two independent evaluation functions, ported separately because the JS
//! and C engines diverge intentionally (see docs/RUST_PORT.md "Evaluation"):
//! `hce` mirrors `frontend/shared/eval_core.js` (persona-weighted, always
//! White-positive at the top level), `engine` mirrors `engine/evaluate.c`
//! (material + PST only, side-to-move relative).

pub mod engine;
pub mod hce;
