//! P1-analog perft parity gate for `engine_position` (the C engine's own
//! move generator — rights-mode castling, 4-way underpromotion, and the
//! confirmed inverted-pawn-attack bug in `is_square_attacked`, all
//! preserved bug-for-bug; see engine_position.rs's module doc). Counts
//! are expected to differ from the JS-variant perft fixture (they're
//! different rulesets, including a real check-detection bug in the C
//! side) — the oracle here is the *actual built C binary*, driven via its
//! `position`/`legal` UCI commands (no native perft command exists), not
//! the JS engine. Regenerate with:
//!
//! ```sh
//! make -C engine
//! python3 tools/c/perft_dump.py > crates/shatrunz-core/tests/fixtures/perft_engine_fixture.json
//! ```

use serde::Deserialize;
use shatrunz_core::engine_position::{generate_legal_moves, EnginePosition};

#[derive(Debug, Deserialize)]
struct Fixture {
    startpos: StartposCounts,
    seeded: Vec<SeededCase>,
}

#[derive(Debug, Deserialize)]
struct StartposCounts {
    depth1: u64,
    depth2: u64,
    depth3: u64,
    depth4: u64,
}

#[derive(Debug, Deserialize)]
struct SeededCase {
    seed: u64,
    path: Vec<String>,
    depth: u32,
    nodes: u64,
}

fn load_fixture() -> Fixture {
    let raw = include_str!("fixtures/perft_engine_fixture.json");
    serde_json::from_str(raw).expect("perft_engine_fixture.json must parse")
}

fn perft(pos: &mut EnginePosition, depth: u32) -> u64 {
    if depth == 0 {
        return 1;
    }
    let moves = generate_legal_moves(pos);
    let mut nodes = 0u64;
    for mut m in moves {
        shatrunz_core::engine_position::make_move(pos, &mut m);
        nodes += perft(pos, depth - 1);
        shatrunz_core::engine_position::unmake_move(pos, &m);
    }
    nodes
}

/// Minimal UCI parser matching `engine/uci.c`'s `str_to_square`: file a-i,
/// rank = 9-row, optional trailing promotion char.
fn apply_uci(pos: &mut EnginePosition, uci: &str) {
    use shatrunz_core::engine_position::ESquare;
    use shatrunz_core::piece::PieceKind;

    let bytes = uci.as_bytes();
    let from = ESquare {
        r: 9 - (bytes[1] - b'0') as usize,
        c: (bytes[0] - b'a') as usize,
    };
    let to = ESquare {
        r: 9 - (bytes[3] - b'0') as usize,
        c: (bytes[2] - b'a') as usize,
    };
    let promo = if bytes.len() > 4 {
        Some(match bytes[4] {
            b'r' => PieceKind::Rook,
            b'b' => PieceKind::Bishop,
            b'n' => PieceKind::Knight,
            _ => PieceKind::Queen,
        })
    } else {
        None
    };

    let legal = generate_legal_moves(pos);
    let mut mv = legal
        .into_iter()
        .find(|m| m.from == from && m.to == to && m.promotion_type == promo)
        .unwrap_or_else(|| panic!("no matching legal move for {uci}"));
    shatrunz_core::engine_position::make_move(pos, &mut mv);
}

#[test]
fn engine_perft_startpos_matches_c_binary() {
    let fixture = load_fixture();
    let mut pos = EnginePosition::new();
    assert_eq!(perft(&mut pos, 1), fixture.startpos.depth1);
    assert_eq!(perft(&mut pos, 2), fixture.startpos.depth2);
    assert_eq!(perft(&mut pos, 3), fixture.startpos.depth3);
    assert_eq!(perft(&mut pos, 4), fixture.startpos.depth4);
}

#[test]
fn engine_perft_seeded_positions_match_c_binary() {
    let fixture = load_fixture();
    for case in &fixture.seeded {
        let mut pos = EnginePosition::new();
        for uci in &case.path {
            apply_uci(&mut pos, uci);
        }
        let nodes = perft(&mut pos, case.depth);
        assert_eq!(nodes, case.nodes, "seed {}: perft(depth={}) mismatch", case.seed, case.depth);
    }
}
