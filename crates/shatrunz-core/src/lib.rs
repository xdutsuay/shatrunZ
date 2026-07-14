//! Pure ShatrunZ game logic (zero I/O). Modules land here milestone by
//! milestone per docs/plans/PLAN_03_rust_port.md; see docs/RUST_PORT.md
//! for the parity checklist.

pub mod board;
pub mod eval;
pub mod game;
pub mod moves;
pub mod phase;
pub mod piece;
pub mod rules;

pub const CRATE_NAME: &str = "shatrunz-core";
