//! FEN round-trip for `EnginePosition` (C-engine variant).

use shatrunz_core::engine_position::{EnginePosition, RIGHTS_ALL};
use shatrunz_core::fen::{
    engine_position_from_fen, engine_position_to_fen, parse_position_fen_line, START_FEN,
};
use shatrunz_core::piece::Color;

#[test]
fn start_fen_parses_board_and_stm() {
    let pos = engine_position_from_fen(START_FEN).expect("parse start fen");
    assert_eq!(pos.side_to_move, Color::White);
    assert_eq!(pos.halfmove_clock, 0);
    assert_eq!(pos.fullmove_number, 1);
    assert_eq!(pos.castling_rights, 0); // PGN header uses `-`
    // Krishna on g-file for both sides
    assert!(pos.board.get(0, 6).is_some());
    assert!(pos.board.get(8, 6).is_some());
}

#[test]
fn new_position_round_trips_with_castling_rights() {
    let pos = EnginePosition::new();
    let fen = engine_position_to_fen(&pos);
    assert!(fen.contains("KQkq"));
    let back = engine_position_from_fen(&fen).expect("round trip");
    assert_eq!(back.castling_rights, RIGHTS_ALL);
    assert_eq!(back.side_to_move, pos.side_to_move);
}

#[test]
fn parse_position_fen_line_splits_moves() {
    let line = "position fen rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - - 0 1 moves e2e4 e7e5";
    let (fen, moves) = parse_position_fen_line(line).expect("split");
    assert_eq!(fen, START_FEN);
    assert_eq!(moves, vec!["e2e4", "e7e5"]);
}

#[test]
fn rejects_en_passant_square() {
    let fen = "rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - e3 0 1";
    assert!(engine_position_from_fen(fen).is_err());
}
