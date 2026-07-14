//! P3-analog search parity gate for `search::engine` (the C engine's own
//! search — capture-first ordering, quiescence with checks, mate scores):
//! deterministic config (randomness=0, untimed `go depth N`, which is the
//! non-iterative `search()` path in engine/uci.c). Fixture is generated
//! by driving the real built `engine/shatrunz_engine` binary. Regenerate
//! with:
//!
//! ```sh
//! make -C engine
//! python3 tools/c/search_engine_dump.py > crates/shatrunz-core/tests/fixtures/search_engine_fixture.json
//! ```
//!
//! **Only depth 1 is bit-exact-parity-tested.** `search()`'s root call
//! passes `INT_MIN`/`INT_MAX` into `alphabeta`, which is signed-overflow
//! UB in C for depth >= 2 (see `search::engine`'s module doc for the full
//! empirical investigation — two independent harnesses calling the exact
//! same shipped `alphabeta`/`order_moves` object code produced different
//! bestmove choices at depth 3, so there's no stable "real" answer to pin
//! a test to there). `engine_search_returns_legal_move_at_deeper_depths`
//! below is a weaker, still-meaningful structural check for depth 2-3:
//! the returned move must actually be legal in the position searched.

use serde::Deserialize;
use shatrunz_core::engine_position::{make_move, EnginePosition};
use shatrunz_core::search::engine::search;

#[derive(Debug, Deserialize)]
struct Fixture {
    positions: Vec<PositionCase>,
}

#[derive(Debug, Deserialize)]
struct PositionCase {
    label: String,
    path: Vec<String>,
    bestmoves: std::collections::HashMap<String, String>,
}

fn load_fixture() -> Fixture {
    let raw = include_str!("fixtures/search_engine_fixture.json");
    serde_json::from_str(raw).expect("search_engine_fixture.json must parse")
}

/// Mirrors `engine/uci.c`'s `square_to_str`/`str_to_square`: file a-i,
/// rank = 9-row, optional trailing promotion char.
fn apply_uci(pos: &mut EnginePosition, uci: &str) {
    use shatrunz_core::engine_position::{generate_legal_moves, ESquare};
    use shatrunz_core::piece::PieceKind;

    let bytes = uci.as_bytes();
    let from = ESquare { r: 9 - (bytes[1] - b'0') as usize, c: (bytes[0] - b'a') as usize };
    let to = ESquare { r: 9 - (bytes[3] - b'0') as usize, c: (bytes[2] - b'a') as usize };
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
    make_move(pos, &mut mv);
}

fn move_to_uci(mv: &shatrunz_core::engine_position::EngineMove) -> String {
    const FILES: &[u8] = b"abcdefghi";
    let promo = match mv.promotion_type {
        Some(shatrunz_core::piece::PieceKind::Rook) => "r",
        Some(shatrunz_core::piece::PieceKind::Bishop) => "b",
        Some(shatrunz_core::piece::PieceKind::Knight) => "n",
        Some(_) => "q",
        None => "",
    };
    format!(
        "{}{}{}{}{}",
        FILES[mv.from.c] as char,
        9 - mv.from.r,
        FILES[mv.to.c] as char,
        9 - mv.to.r,
        promo
    )
}

#[test]
fn engine_search_bestmove_matches_c_binary() {
    let fixture = load_fixture();
    for case in &fixture.positions {
        let mut pos = EnginePosition::new();
        for uci in &case.path {
            apply_uci(&mut pos, uci);
        }
        for (key, expected) in &case.bestmoves {
            let depth: i32 = key.strip_prefix("depth").unwrap().parse().unwrap();
            let mut pos_copy = pos.clone();
            let mv = search(&mut pos_copy, depth, 0).unwrap_or_else(|| panic!("{}: no move found", case.label));
            let got = move_to_uci(&mv);
            assert_eq!(&got, expected, "{} depth{depth}: bestmove mismatch", case.label);
        }
    }
}

#[test]
fn engine_search_returns_legal_move_at_deeper_depths() {
    use shatrunz_core::engine_position::generate_legal_moves;

    let fixture = load_fixture();
    for case in &fixture.positions {
        let mut pos = EnginePosition::new();
        for uci in &case.path {
            apply_uci(&mut pos, uci);
        }
        for depth in [2, 3] {
            let mut pos_copy = pos.clone();
            let legal = generate_legal_moves(&mut pos_copy);
            let mv = search(&mut pos_copy, depth, 0)
                .unwrap_or_else(|| panic!("{} depth{depth}: no move found", case.label));
            assert!(
                legal.iter().any(|m| m.from == mv.from && m.to == mv.to && m.promotion_type == mv.promotion_type),
                "{} depth{depth}: search returned an illegal move {:?}",
                case.label,
                mv
            );
        }
    }
}
