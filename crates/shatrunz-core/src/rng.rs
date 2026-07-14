//! Faithful port of the `mulberry32` PRNG used throughout the JS test
//! suite (`tests-js/fuzz_rules_invariants.test.js`, `tools/js/perft.mjs`,
//! etc.) — a deterministic, seedable RNG so fuzz runs are reproducible
//! (P4 in docs/plans/PLAN_03_rust_port.md: "port fuzz_rules_invariants +
//! invariants/game_invariants.js to Rust with a mulberry32 port").
//!
//! All internal state is `u32`; JS's `|0`/`>>>0`/`Math.imul` on
//! (conceptually) int32 values produce the same bit patterns as u32
//! wrapping arithmetic — only the *interpretation* of the sign bit
//! differs between signed/unsigned, which XOR/OR/logical-shift/wrapping
//! multiply/add never observe.

#[derive(Debug, Clone, Copy)]
pub struct Mulberry32 {
    a: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Mulberry32 { a: seed }
    }

    /// Mirrors the `rand()` closure body exactly, statement for statement.
    pub fn next_f64(&mut self) -> f64 {
        self.a = self.a.wrapping_add(0x6D2B79F5);
        let mut t = self.a;
        t = (t ^ (t >> 15)).wrapping_mul(1 | t);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }

    /// Mirrors `pick(rng, arr)` (fuzz_rules_invariants.test.js:19-21):
    /// `arr[Math.floor(rng() * arr.length)]`.
    pub fn pick_index(&mut self, len: usize) -> usize {
        (self.next_f64() * len as f64).floor() as usize
    }
}
