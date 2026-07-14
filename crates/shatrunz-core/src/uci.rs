//! UCI square/move codec shared by `shatrunz-mcp` and (later)
//! `shatrunz-engine`. Mirrors `frontend/shared/uci.js`'s
//! `parseUCIMove`/`moveToUCI` and `engine/uci.c`'s `square_to_uci`: file
//! a-i, rank = 9-row. **FROZEN** per docs/RUST_PORT.md "UCI commands" —
//! this codec is an external contract (used in PGN/UCI I/O), not a value
//! to "clean up".

use crate::board::Board;
use crate::game::Game;
use crate::moves::{Move, MoveTarget, Square};
use crate::piece::PieceKind;

const FILES: &[u8] = b"abcdefghi";

/// Mirrors `parseUCIMove` (frontend/shared/uci.js:5-23). Returns `None`
/// for malformed input, exactly like the JS version returning `null`.
pub fn parse_uci_move(uci: &str) -> Option<(Square, MoveTarget)> {
    let bytes = uci.as_bytes();
    if bytes.len() < 4 {
        return None;
    }
    let from_file = FILES.iter().position(|&f| f == bytes[0])?;
    let from_rank_digit = (bytes[1] as char).to_digit(10)?;
    let to_file = FILES.iter().position(|&f| f == bytes[2])?;
    let to_rank_digit = (bytes[3] as char).to_digit(10)?;

    let from_rank = 9i32 - from_rank_digit as i32;
    let to_rank = 9i32 - to_rank_digit as i32;
    if !(0..9).contains(&from_rank) || !(0..9).contains(&to_rank) {
        return None;
    }

    Some((
        Square { r: from_rank as usize, c: from_file },
        MoveTarget::plain(to_rank as usize, to_file),
    ))
}

/// Mirrors `moveToUCI` (frontend/shared/uci.js:25-40): appends `q` when
/// the moving piece is a pawn landing on row 0/8 (JS rules auto-queen;
/// see docs/RUST_PORT.md "Rules / movement" for the deferred
/// underpromotion variant).
pub fn move_to_uci(board: &Board, m: Move) -> String {
    let from_file = FILES[m.from.c] as char;
    let to_file = FILES[m.to.c] as char;
    let from_rank = 9 - m.from.r;
    let to_rank = 9 - m.to.r;
    let moved = board.get(m.from.r, m.from.c);
    let promo = if matches!(moved, Some(p) if p.kind == PieceKind::Pawn) && (m.to.r == 0 || m.to.r == 8) {
        "q"
    } else {
        ""
    };
    format!("{from_file}{from_rank}{to_file}{to_rank}{promo}")
}

/// Convenience over `move_to_uci` for every legal move of `color` in
/// `game`, in board-scan order (same order as `Game::legal_moves`).
pub fn legal_uci_moves(game: &Game, color: crate::piece::Color) -> Vec<String> {
    game.legal_moves(color)
        .into_iter()
        .map(|m| move_to_uci(&game.board, m))
        .collect()
}
