//! Unit-level parity checks for FROZEN contracts (position_key, status
//! strings) and the "king absent" quirk. Broad move-generation parity is
//! covered by tests/perft.rs against the JS oracle; the fixed strings here
//! are cross-checked directly against `node -e "new Game().getHash()"` /
//! `checkStatus()` output (see docs/RUST_PORT.md "Game state").

use shatrunz_core::board::Board;
use shatrunz_core::game::Game;
use shatrunz_core::moves::{CastlingSide, MoveTarget, Square};
use shatrunz_core::piece::{Color, Piece, PieceKind};
use shatrunz_core::rules;

#[test]
fn position_key_matches_js_oracle_at_startpos() {
    let game = Game::new();
    assert_eq!(
        game.position_key(),
        "w|br00bn01bb02bq03bk04bb05bz06bn07br08bp10bp11bp12bp13bp14bp15bp16bp17bp18wp70wp71wp72wp73wp74wp75wp76wp77wp78wr80wn81wb82wq83wk84wb85wz86wn87wr88"
    );
}

#[test]
fn check_status_matches_js_oracle_at_startpos() {
    let game = Game::new();
    let status = game.check_status();
    assert!(!status.over);
    assert_eq!(status.msg, "White's Turn");
    assert_eq!(status.winner, None);
}

#[test]
fn is_king_in_check_true_when_king_absent() {
    // rules.js:206 — a deliberate quirk kept for parity, not a bug.
    let board = Board::empty();
    assert!(rules::is_king_in_check(&board, Color::White));
}

fn synthetic_game(placements: &[(usize, usize, Piece)], turn: Color) -> Game {
    let mut game = Game::new();
    game.board = Board::empty();
    for (r, c, piece) in placements {
        game.board.set(*r, *c, Some(*piece));
    }
    game.turn = turn;
    game
}

/// Cross-checked against the JS oracle:
/// `node -e "new Game(); g.checkStatus()"` with the same placements gives
/// `{"over":true,"msg":"CHECKMATE! White Wins","winner":"w"}` — see the M1
/// session log entry in docs/RUST_PORT.md.
#[test]
fn checkmate_ladder_mate_matches_js_oracle() {
    let game = synthetic_game(
        &[
            (0, 0, Piece { color: Color::Black, kind: PieceKind::King }),
            (0, 8, Piece { color: Color::White, kind: PieceKind::Rook }),
            (1, 8, Piece { color: Color::White, kind: PieceKind::Rook }),
            (8, 4, Piece { color: Color::White, kind: PieceKind::King }),
        ],
        Color::Black,
    );
    let status = game.check_status();
    assert!(status.over);
    assert_eq!(status.msg, "CHECKMATE! White Wins");
    assert_eq!(status.winner, Some(Color::White));
}

/// Cross-checked against the JS oracle the same way — gives
/// `{"over":true,"msg":"Stalemate","winner":null}`.
#[test]
fn stalemate_corner_matches_js_oracle() {
    let game = synthetic_game(
        &[
            (0, 0, Piece { color: Color::Black, kind: PieceKind::King }),
            (2, 1, Piece { color: Color::White, kind: PieceKind::King }),
            (1, 2, Piece { color: Color::White, kind: PieceKind::Queen }),
        ],
        Color::Black,
    );
    let status = game.check_status();
    assert!(status.over);
    assert_eq!(status.msg, "Stalemate");
    assert_eq!(status.winner, None);
}

#[test]
fn castling_moves_king_and_rook_and_updates_hash() {
    // Clear the path for White kingside castling: back rank at setup is
    // R N B Q K B Z N R, so F(5)=Bishop and G(6)=Krishna both sit in front
    // of pawns and must step out via the pawn-vacated squares first.
    let mut game = Game::new();

    let white_moves: [(Square, MoveTarget); 4] = [
        (Square { r: 7, c: 5 }, MoveTarget::plain(6, 5)), // F-pawn push
        (Square { r: 7, c: 6 }, MoveTarget::plain(6, 6)), // G-pawn push
        (Square { r: 8, c: 5 }, MoveTarget::plain(7, 6)), // bishop out
        (Square { r: 8, c: 6 }, MoveTarget::plain(7, 5)), // krishna out
    ];
    for (from, to) in white_moves {
        assert!(game.execute_move(from, to), "setup move should be legal");
        let black_moves = game.legal_moves(Color::Black);
        assert!(!black_moves.is_empty());
        let reply = black_moves[0];
        assert!(game.execute_move(reply.from, reply.to));
    }

    let legal = game.legal_moves(Color::White);
    let castle = legal
        .iter()
        .find(|m| m.to.is_castling && m.to.castling_side == Some(CastlingSide::King))
        .copied()
        .expect("kingside castling should be legal once G8 is clear");

    let before_key = game.position_key();
    assert!(game.execute_move(castle.from, castle.to));

    assert_eq!(game.board.get(8, 6).map(|p| p.kind), Some(shatrunz_core::piece::PieceKind::King));
    assert_eq!(game.board.get(8, 5).map(|p| p.kind), Some(shatrunz_core::piece::PieceKind::Rook));
    assert_eq!(game.board.get(8, 4), None);
    assert_eq!(game.board.get(8, 8), None);
    assert_ne!(game.position_key(), before_key);

    assert!(game.undo_last_move());
    assert_eq!(game.position_key(), before_key);
    assert_eq!(game.board.get(8, 4).map(|p| p.kind), Some(shatrunz_core::piece::PieceKind::King));
    assert_eq!(game.board.get(8, 8).map(|p| p.kind), Some(shatrunz_core::piece::PieceKind::Rook));
}
