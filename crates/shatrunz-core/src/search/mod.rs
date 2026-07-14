//! Two independent search algorithms exist per docs/RUST_PORT.md "Search":
//! `persona` mirrors `frontend/ai.js` (unordered negamax, captures-only
//! quiescence, no mate scoring) and is ported here. The C engine's search
//! (`engine/search.c`: capture-first ordering, quiescence with checks,
//! proper mate scores) is **not** ported yet — it's written against
//! `engine/position.c`'s own move generator, which tracks castling rights
//! as a bitmask and generates all four underpromotion types per
//! promoting pawn move, neither of which the currently-ported
//! `shatrunz-core::rules` supports (it matches the JS variant: position-
//! only castling, auto-queen). Porting `search::engine` faithfully means
//! first porting that C-specific move generator, which is exactly the
//! "rights-mode + underpromotions" work explicitly scoped to M4 in
//! docs/plans/PLAN_03_rust_port.md ("Native engine" section) — so
//! `search::engine` is deferred there rather than built against the wrong
//! move generator now and needing a rewrite.

pub mod persona;
