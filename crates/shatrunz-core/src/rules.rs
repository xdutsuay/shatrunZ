//! Faithful port of `frontend/rules.js`. Iteration order (row-major board
//! scan, per-piece offset order, direction order) is preserved exactly —
//! it feeds search move ordering later (see docs/RUST_PORT.md "Rules /
//! movement": "exact JS move-generation order replicated").

use crate::board::{in_bounds, Board, BOARD_SIZE};
use crate::moves::{CastlingSide, Move, MoveTarget, Square};
use crate::piece::{Color, PieceKind};

/// Mirrors `Rules.getAllLegalMoves` (rules.js:6-19). Takes `&Board`
/// (read-only from the caller's point of view) — internally uses one
/// mutable scratch copy for the make/unmake king-safety check, same as
/// JS mutating `this.board` in place and always reverting.
pub fn get_all_legal_moves(board: &Board, color: Color) -> Vec<Move> {
    let mut scratch = board.clone();
    let mut moves = Vec::new();
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            match scratch.get(r, c) {
                Some(p) if p.color == color => {}
                _ => continue,
            }
            for to in get_legal_moves_mut(&mut scratch, r, c, true) {
                moves.push(Move {
                    from: Square { r, c },
                    to,
                });
            }
        }
    }
    moves
}

/// Mirrors `Rules.getLegalMoves` (rules.js:21-134). Takes `&Board`; see
/// `get_all_legal_moves` for why this is a cloning wrapper.
pub fn get_legal_moves(
    board: &Board,
    r: usize,
    c: usize,
    check_king_safety: bool,
) -> Vec<MoveTarget> {
    let mut scratch = board.clone();
    get_legal_moves_mut(&mut scratch, r, c, check_king_safety)
}

fn get_legal_moves_mut(
    board: &mut Board,
    r: usize,
    c: usize,
    check_king_safety: bool,
) -> Vec<MoveTarget> {
    let piece = match board.get(r, c) {
        Some(p) => p,
        None => return Vec::new(),
    };
    let kind = piece.kind;
    let color = piece.color;
    let forward: isize = if color == Color::White { -1 } else { 1 };
    let ir = r as isize;
    let ic = c as isize;

    let mut moves: Vec<MoveTarget> = Vec::new();

    match kind {
        PieceKind::Pawn => {
            if in_bounds(ir + forward, ic) && board.get((ir + forward) as usize, c).is_none() {
                moves.push(MoveTarget::plain((ir + forward) as usize, c));
                let start_rank: isize = if color == Color::White { 7 } else { 1 };
                if ir == start_rank
                    && board
                        .get((ir + forward * 2) as usize, c)
                        .is_none()
                    && board.get((ir + forward) as usize, c).is_none()
                {
                    moves.push(MoveTarget::plain((ir + forward * 2) as usize, c));
                }
            }
            for (dr, dc) in [(forward, -1isize), (forward, 1isize)] {
                let tr = ir + dr;
                let tc = ic + dc;
                if in_bounds(tr, tc) {
                    if let Some(target) = board.get(tr as usize, tc as usize) {
                        if target.color != color {
                            moves.push(MoveTarget::plain(tr as usize, tc as usize));
                        }
                    }
                }
            }
        }
        PieceKind::Rook | PieceKind::Bishop | PieceKind::Queen => {
            let mut directions: Vec<(isize, isize)> = Vec::new();
            if kind != PieceKind::Bishop {
                directions.extend([(0, 1), (0, -1), (1, 0), (-1, 0)]);
            }
            if kind != PieceKind::Rook {
                directions.extend([(1, 1), (1, -1), (-1, 1), (-1, -1)]);
            }
            for (dr, dc) in directions {
                for i in 1..BOARD_SIZE as isize {
                    let tr = ir + dr * i;
                    let tc = ic + dc * i;
                    if !in_bounds(tr, tc) {
                        break;
                    }
                    match board.get(tr as usize, tc as usize) {
                        None => moves.push(MoveTarget::plain(tr as usize, tc as usize)),
                        Some(target) => {
                            if target.color != color {
                                moves.push(MoveTarget::plain(tr as usize, tc as usize));
                            }
                            break;
                        }
                    }
                }
            }
        }
        PieceKind::Knight | PieceKind::King | PieceKind::Krishna => {
            let offsets: &[(isize, isize)] = if kind == PieceKind::Knight {
                &[
                    (-2, -1),
                    (-2, 1),
                    (-1, -2),
                    (-1, 2),
                    (1, -2),
                    (1, 2),
                    (2, -1),
                    (2, 1),
                ]
            } else {
                &[
                    (-1, -1),
                    (-1, 0),
                    (-1, 1),
                    (0, -1),
                    (0, 1),
                    (1, -1),
                    (1, 0),
                    (1, 1),
                ]
            };
            for (dr, dc) in offsets {
                let tr = ir + dr;
                let tc = ic + dc;
                if in_bounds(tr, tc) {
                    let target = board.get(tr as usize, tc as usize);
                    if kind == PieceKind::Krishna {
                        if target.is_none() {
                            moves.push(MoveTarget::plain(tr as usize, tc as usize));
                        }
                    } else if target.is_none() || target.unwrap().color != color {
                        moves.push(MoveTarget::plain(tr as usize, tc as usize));
                    }
                }
            }
        }
    }

    // Krishna can never be captured, by any piece type (rules.js:74-77).
    moves.retain(|m| !matches!(board.get(m.r, m.c), Some(t) if t.kind == PieceKind::Krishna));

    if check_king_safety {
        moves.retain(|m| {
            let saved_target = board.get(m.r, m.c);
            let saved_source = board.get(r, c);
            board.set(m.r, m.c, saved_source);
            board.set(r, c, None);
            let in_check = is_king_in_check(board, color);
            board.set(r, c, saved_source);
            board.set(m.r, m.c, saved_target);
            !in_check
        });

        // Castling: king steps two squares; JS is position-only (no
        // rights tracking) — see docs/RUST_PORT.md "Rules / movement".
        if kind == PieceKind::King && !is_king_in_check(board, color) {
            let king_rank: usize = if color == Color::White { 8 } else { 0 };
            if r == king_rank && c == 4 {
                // Kingside: F(5), G(6) empty; rook at I(8).
                if board.get(king_rank, 5).is_none() && board.get(king_rank, 6).is_none() {
                    if let Some(rook) = board.get(king_rank, 8) {
                        if rook.kind == PieceKind::Rook
                            && rook.color == color
                            && !is_square_attacked(board, king_rank, 5, color)
                            && !is_square_attacked(board, king_rank, 6, color)
                        {
                            moves.push(MoveTarget::castling(king_rank, 6, CastlingSide::King));
                        }
                    }
                }
                // Queenside: D(3), C(2), B(1) empty; rook at A(0).
                if board.get(king_rank, 3).is_none()
                    && board.get(king_rank, 2).is_none()
                    && board.get(king_rank, 1).is_none()
                {
                    if let Some(rook) = board.get(king_rank, 0) {
                        if rook.kind == PieceKind::Rook
                            && rook.color == color
                            && !is_square_attacked(board, king_rank, 3, color)
                            && !is_square_attacked(board, king_rank, 2, color)
                        {
                            moves.push(MoveTarget::castling(king_rank, 2, CastlingSide::Queen));
                        }
                    }
                }
            }
        }
    }

    moves
}

const KNIGHT_OFFSETS: [(isize, isize); 8] = [
    (-2, -1),
    (-2, 1),
    (-1, -2),
    (-1, 2),
    (1, -2),
    (1, 2),
    (2, -1),
    (2, 1),
];

const RAY_DIRECTIONS: [(isize, isize); 8] = [
    (0, 1),
    (0, -1),
    (1, 0),
    (-1, 0),
    (1, 1),
    (1, -1),
    (-1, 1),
    (-1, -1),
];

/// Mirrors `Rules.isSquareAttacked` (rules.js:136-195): is `(r, c)`
/// attacked by any `ally_color`-opposing piece? Krishna blocks rays but
/// never itself attacks (it has no capture moves, so it's excluded from
/// both the ray and knight scans by construction).
pub fn is_square_attacked(board: &Board, r: usize, c: usize, ally_color: Color) -> bool {
    let enemy = ally_color.opposite();
    let ir = r as isize;
    let ic = c as isize;

    for (dr, dc) in KNIGHT_OFFSETS {
        let tr = ir + dr;
        let tc = ic + dc;
        if in_bounds(tr, tc) {
            if let Some(p) = board.get(tr as usize, tc as usize) {
                if p.color == enemy && p.kind == PieceKind::Knight {
                    return true;
                }
            }
        }
    }

    for (dr, dc) in RAY_DIRECTIONS {
        for i in 1..BOARD_SIZE as isize {
            let tr = ir + dr * i;
            let tc = ic + dc * i;
            if !in_bounds(tr, tc) {
                break;
            }
            if let Some(p) = board.get(tr as usize, tc as usize) {
                if p.color == enemy {
                    if p.kind == PieceKind::Krishna {
                        break;
                    }
                    let is_ortho = dr == 0 || dc == 0;
                    if is_ortho && (p.kind == PieceKind::Rook || p.kind == PieceKind::Queen) {
                        return true;
                    }
                    if !is_ortho && (p.kind == PieceKind::Bishop || p.kind == PieceKind::Queen) {
                        return true;
                    }
                    if i == 1 && p.kind == PieceKind::King {
                        return true;
                    }
                    if i == 1 && !is_ortho && p.kind == PieceKind::Pawn {
                        if enemy == Color::White && dr == 1 {
                            return true;
                        }
                        if enemy == Color::Black && dr == -1 {
                            return true;
                        }
                    }
                }
                break;
            }
        }
    }

    false
}

/// Mirrors `Rules.isKingInCheck` (rules.js:197-243). Returns true if the
/// king is absent from the board (rules.js:206) — a deliberate quirk kept
/// for parity, not a bug.
pub fn is_king_in_check(board: &Board, color: Color) -> bool {
    let mut king_sq: Option<(usize, usize)> = None;
    'search: for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                if p.color == color && p.kind == PieceKind::King {
                    king_sq = Some((r, c));
                    break 'search;
                }
            }
        }
    }
    match king_sq {
        None => true,
        Some((r, c)) => is_square_attacked(board, r, c, color),
    }
}
