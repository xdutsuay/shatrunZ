//! Focused regression for M4 engine-position UCI helpers
//! (`square_to_uci` / `uci_to_square` / `engine_move_to_uci` /
//! `apply_uci_move`) — mirrors `engine/uci.c` square encoding and the
//! `position startpos moves …` apply loop. Distinct from `uci_parity.rs`,
//! which gates the JS-facing `uci` module.

use shatrunz_core::engine_position::{
    apply_uci_move, engine_move_to_uci, square_to_uci, uci_to_square, ESquare, EngineMove,
    EnginePosition,
};
use shatrunz_core::piece::{Color, PieceKind};

#[test]
fn square_uci_round_trips_corners_and_center() {
    for (token, r, c) in [("a9", 0, 0), ("i1", 8, 8), ("e5", 4, 4), ("b1", 8, 1)] {
        let sq = uci_to_square(token).unwrap_or_else(|| panic!("parse {token}"));
        assert_eq!(sq, ESquare { r, c }, "{token}");
        assert_eq!(square_to_uci(sq), token);
    }
    assert_eq!(uci_to_square("j1"), None);
    assert_eq!(uci_to_square("a"), None);
    assert_eq!(uci_to_square("a0"), None);
}

#[test]
fn engine_move_to_uci_encodes_quiet_and_underpromotion() {
    let quiet = EngineMove {
        from: ESquare { r: 8, c: 1 },
        to: ESquare { r: 6, c: 2 },
        captured: None,
        is_promotion: false,
        promotion_type: None,
        old_castling_rights: 0,
    };
    assert_eq!(engine_move_to_uci(&quiet), "b1c3");

    let under = EngineMove {
        from: ESquare { r: 1, c: 0 },
        to: ESquare { r: 0, c: 0 },
        captured: None,
        is_promotion: true,
        promotion_type: Some(PieceKind::Knight),
        old_castling_rights: 0,
    };
    assert_eq!(engine_move_to_uci(&under), "a8a9n");
}

#[test]
fn apply_uci_move_b1c3_flips_side_and_moves_knight() {
    let mut pos = EnginePosition::new();
    assert_eq!(pos.side_to_move, Color::White);
    let from = uci_to_square("b1").unwrap();
    let to = uci_to_square("c3").unwrap();
    let piece = pos.board.get(from.r, from.c).expect("knight on b1");
    assert_eq!(piece.kind, PieceKind::Knight);
    assert_eq!(piece.color, Color::White);

    assert!(apply_uci_move(&mut pos, "b1c3"));
    assert_eq!(pos.side_to_move, Color::Black);
    assert!(pos.board.get(from.r, from.c).is_none());
    assert_eq!(pos.board.get(to.r, to.c), Some(piece));
}

#[test]
fn apply_uci_move_rejects_illegal_token() {
    let mut pos = EnginePosition::new();
    assert!(!apply_uci_move(&mut pos, "b1b1"));
    assert!(!apply_uci_move(&mut pos, "xyz"));
    assert_eq!(pos.side_to_move, Color::White);
}
