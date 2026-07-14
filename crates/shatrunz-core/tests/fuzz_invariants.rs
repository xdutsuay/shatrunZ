//! P4 fuzz invariants (docs/plans/PLAN_03_rust_port.md "Parity
//! verification"): port of `tests-js/fuzz_rules_invariants.test.js` +
//! `tests-js/invariants/game_invariants.js`, using the `rng::Mulberry32`
//! port verified bit-for-bit against the JS oracle (see rng.rs's doc
//! comment). Board-shape/color/piece-type invariants from the JS version
//! are structurally guaranteed by Rust's types (fixed-size board, enums)
//! and aren't re-checked; "exactly one king per side" is the one
//! substantive invariant fuzzed here.
//!
//! Default duration is 3s (vs JS's 60s) to keep `cargo test` fast; set
//! `FUZZ_MS` to fuzz longer. Set `FUZZ_SEED` to reproduce a specific run
//! (mirrors the JS test's `FUZZ_SEED` env var).

use std::time::{Duration, Instant};

use shatrunz_core::board::BOARD_SIZE;
use shatrunz_core::game::Game;
use shatrunz_core::piece::{Color, PieceKind};
use shatrunz_core::rng::Mulberry32;

fn assert_game_invariants(game: &Game, label: &str) {
    let mut white_kings = 0;
    let mut black_kings = 0;
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = game.board.get(r, c) {
                if p.kind == PieceKind::King {
                    if p.color == Color::White {
                        white_kings += 1;
                    } else {
                        black_kings += 1;
                    }
                }
            }
        }
    }
    assert_eq!(white_kings, 1, "{label}: expected 1 white king, got {white_kings}");
    assert_eq!(black_kings, 1, "{label}: expected 1 black king, got {black_kings}");
}

#[test]
fn fuzz_core_rules_invariants_hold_under_random_play_and_undo() {
    let seed: u32 = std::env::var("FUZZ_SEED")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(|| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u32
        });
    let fuzz_ms: u64 = std::env::var("FUZZ_MS").ok().and_then(|s| s.parse().ok()).unwrap_or(3_000);

    let mut rng = Mulberry32::new(seed);
    let deadline = Instant::now() + Duration::from_millis(fuzz_ms);

    let mut game = Game::new();
    assert_game_invariants(&game, "init");

    let mut plies: u32 = 0;
    let mut hash_stack: Vec<String> = Vec::new();

    while Instant::now() < deadline {
        let legal = game.legal_moves(game.turn);

        if legal.is_empty() {
            let status = game.check_status();
            assert!(status.over, "expected game over when no legal moves (seed={seed})");
            game = Game::new();
            hash_stack.clear();
            plies = 0;
            assert_game_invariants(&game, "reset");
            continue;
        }

        let idx = rng.pick_index(legal.len());
        let m = legal[idx];
        let before_hash = game.position_key();
        hash_stack.push(before_hash);

        let ok = game.execute_move(m.from, m.to);
        assert!(ok, "execute_move returned false (seed={seed}) move={:?}", m);
        assert_game_invariants(&game, &format!("after ply {plies} seed={seed}"));

        // Occasionally undo 1-3 plies and ensure the position_key restores.
        if plies > 4 && rng.next_f64() < 0.12 {
            let undo_count = 1 + (rng.next_f64() * 3.0).floor() as u32;
            let mut i = 0;
            while i < undo_count && !hash_stack.is_empty() {
                let expected = hash_stack.pop().unwrap();
                let ok = game.undo_last_move();
                assert!(ok, "undo_last_move returned false unexpectedly (seed={seed})");
                assert_game_invariants(&game, &format!("after undo seed={seed}"));
                let cur = game.position_key();
                assert_eq!(cur, expected, "hash mismatch after undo (seed={seed})");
                i += 1;
            }
        }

        plies += 1;

        // Avoid pathologically long games in one line; reset occasionally.
        if plies > 250 && rng.next_f64() < 0.05 {
            game = Game::new();
            hash_stack.clear();
            plies = 0;
            assert_game_invariants(&game, &format!("random reset seed={seed}"));
        }
    }
}
