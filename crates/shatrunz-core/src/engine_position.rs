//! Faithful port of `engine/position.c` — the C engine's **own** move
//! generator, deliberately kept separate from `rules`/`game` (the JS
//! variant): castling-rights bitmask instead of position-only castling,
//! 4-way underpromotion instead of auto-queen, and its own
//! `is_square_attacked`/`is_in_check`. See docs/RUST_PORT.md "Rules /
//! movement" for why these two variants are never unified mid-port.
//!
//! **Confirmed live bug in position.c, preserved here bug-for-bug**:
//! `is_square_attacked`'s pawn-attack check has an inverted sign. A pawn
//! attacks the squares diagonally *in front* of it (in its own forward
//! direction); the C code instead checks the squares diagonally in front
//! of the *target* in the attacking color's forward direction — off by a
//! sign flip, so it looks on the wrong side entirely. Verified with a
//! standalone C harness linking the real `position.c`
//! (`is_square_attacked`/`is_in_check` called directly on hand-built
//! positions, bypassing the need to reach them via legal moves):
//! a black pawn at (1,4) — its actual attack squares are (2,3)/(2,5) —
//! is reported as attacking (0,3)/(0,5) instead, and a white king at
//! (2,3) (genuinely attacked) is reported *not* in check while a king at
//! (0,3) (not attacked) is reported *in check*. This means the C engine's
//! check/checkmate detection, castling-through-check safety, and search's
//! `move_gives_check`/`terminal_score` are all wrong for pawn checks in
//! production today — and that wrongness is exactly what must be
//! reproduced for byte-parity with the real binary until this is a
//! deliberate, documented post-port fix (see docs/RUST_PORT.md
//! "Evaluation"/"Search" for the sibling JS piece-square bug found the
//! same way).
//!
//! Also a real, separate divergence from the JS variant (not a bug, just
//! different by design): `find_king`/`is_in_check` return **false** when
//! the king is missing from the board — the opposite of
//! `rules::is_king_in_check`'s FROZEN "true if king absent" quirk.

use crate::board::{in_bounds, Board, BOARD_SIZE};
use crate::piece::{Color, Piece, PieceKind};

pub const RIGHT_WK: u8 = 1;
pub const RIGHT_WQ: u8 = 2;
pub const RIGHT_BK: u8 = 4;
pub const RIGHT_BQ: u8 = 8;
pub const RIGHTS_ALL: u8 = 15;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ESquare {
    pub r: usize,
    pub c: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EngineMove {
    pub from: ESquare,
    pub to: ESquare,
    pub captured: Option<Piece>,
    pub is_promotion: bool,
    pub promotion_type: Option<PieceKind>,
    /// Written by `make_move` (mirrors `move->old_castling_rights =
    /// pos->castling_rights` in position.c:167, a side effect on the move
    /// itself so `unmake_move` can restore it).
    pub old_castling_rights: u8,
}

#[derive(Debug, Clone)]
pub struct EnginePosition {
    pub board: Board,
    pub side_to_move: Color,
    pub halfmove_clock: i32,
    pub fullmove_number: i32,
    pub castling_rights: u8,
}

impl Default for EnginePosition {
    fn default() -> Self {
        Self::new()
    }
}

impl EnginePosition {
    /// Mirrors `init_position` (position.c:33-61).
    pub fn new() -> Self {
        EnginePosition {
            board: Board::setup(),
            side_to_move: Color::White,
            halfmove_clock: 0,
            fullmove_number: 1,
            castling_rights: RIGHTS_ALL,
        }
    }
}

const KNIGHT_DIRS: [(i32, i32); 8] =
    [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)];
const BISHOP_DIRS: [(i32, i32); 4] = [(-1, -1), (-1, 1), (1, -1), (1, 1)];
const ROOK_DIRS: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
const KING_DIRS: [(i32, i32); 8] =
    [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)];

/// Mirrors `is_square_attacked` (position.c:64-143) — **including the
/// inverted pawn-attack bug documented above**.
pub fn is_square_attacked(pos: &EnginePosition, sq: ESquare, by_color: Color) -> bool {
    let r = sq.r as i32;
    let c = sq.c as i32;

    for (dr, dc) in KNIGHT_DIRS {
        let (nr, nc) = (r + dr, c + dc);
        if in_bounds(nr as isize, nc as isize) {
            if let Some(p) = pos.board.get(nr as usize, nc as usize) {
                if p.color == by_color && p.kind == PieceKind::Knight {
                    return true;
                }
            }
        }
    }

    for (group, dirs) in [(0, &BISHOP_DIRS[..]), (1, &ROOK_DIRS[..])] {
        let is_bishop_group = group == 0;
        for &(dr, dc) in dirs {
            let (mut nr, mut nc) = (r, c);
            loop {
                nr += dr;
                nc += dc;
                if !in_bounds(nr as isize, nc as isize) {
                    break;
                }
                if let Some(p) = pos.board.get(nr as usize, nc as usize) {
                    if p.color == by_color {
                        let pt = p.kind;
                        if pt == PieceKind::Queen
                            || (is_bishop_group && pt == PieceKind::Bishop)
                            || (!is_bishop_group && pt == PieceKind::Rook)
                        {
                            return true;
                        }
                    }
                    break;
                }
            }
        }
    }

    for (dr, dc) in KING_DIRS {
        let (nr, nc) = (r + dr, c + dc);
        if in_bounds(nr as isize, nc as isize) {
            if let Some(p) = pos.board.get(nr as usize, nc as usize) {
                if p.color == by_color && p.kind == PieceKind::King {
                    return true;
                }
            }
        }
    }

    // Pawn attacks — see the module doc for the confirmed inverted sign.
    let pawn_dir: i32 = if by_color == Color::White { -1 } else { 1 };
    for dc in [-1i32, 1] {
        let (nr, nc) = (r + pawn_dir, c + dc);
        if in_bounds(nr as isize, nc as isize) {
            if let Some(p) = pos.board.get(nr as usize, nc as usize) {
                if p.color == by_color && p.kind == PieceKind::Pawn {
                    return true;
                }
            }
        }
    }

    false
}

fn find_king(pos: &EnginePosition, color: Color) -> Option<ESquare> {
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = pos.board.get(r, c) {
                if p.color == color && p.kind == PieceKind::King {
                    return Some(ESquare { r, c });
                }
            }
        }
    }
    None
}

/// Mirrors `is_in_check` (position.c:156-162): **false** if the king is
/// missing — the opposite of `rules::is_king_in_check`'s quirk. Not a
/// bug, just a real JS/C divergence.
pub fn is_in_check(pos: &EnginePosition, color: Color) -> bool {
    match find_king(pos, color) {
        None => false,
        Some(sq) => is_square_attacked(pos, sq, color.opposite()),
    }
}

fn rights_bit_for_king(color: Color) -> u8 {
    if color == Color::White {
        RIGHT_WK | RIGHT_WQ
    } else {
        RIGHT_BK | RIGHT_BQ
    }
}

/// Mirrors `make_move` (position.c:165-226). Writes `old_castling_rights`
/// onto `mv` so `unmake_move` can restore it, matching the C side effect.
pub fn make_move(pos: &mut EnginePosition, mv: &mut EngineMove) {
    mv.old_castling_rights = pos.castling_rights;

    let piece = pos.board.get(mv.from.r, mv.from.c).expect("make_move: no piece at from");
    pos.board.set(mv.to.r, mv.to.c, Some(piece));
    pos.board.set(mv.from.r, mv.from.c, None);

    if mv.is_promotion {
        pos.board.set(
            mv.to.r,
            mv.to.c,
            Some(Piece { color: pos.side_to_move, kind: mv.promotion_type.unwrap() }),
        );
    }

    // Castling: king moves 2 files.
    if piece.kind == PieceKind::King && (mv.to.c as i32 - mv.from.c as i32).abs() == 2 {
        let r = mv.to.r;
        let kingside = mv.to.c > mv.from.c;
        let rook_from_c = if kingside { 8 } else { 0 };
        let rook_to_c = if kingside { 5 } else { 3 };
        let rook = pos.board.get(r, rook_from_c);
        pos.board.set(r, rook_to_c, rook);
        pos.board.set(r, rook_from_c, None);
    }

    if piece.kind == PieceKind::King {
        pos.castling_rights &= !rights_bit_for_king(pos.side_to_move);
    }
    // Rook home-square rights, cleared on move-from OR move-to (a capture
    // on the home square also revokes rights) — mirrors position.c:211-218
    // exactly, including its square-index-72/80/0/8 magic numbers, which
    // correspond to (r=8,c=0)/(r=8,c=8)/(r=0,c=0)/(r=0,c=8) on this 9x9
    // board (square = r*9 + c).
    let sq_idx = |s: ESquare| s.r * 9 + s.c;
    let (from_idx, to_idx) = (sq_idx(mv.from), sq_idx(mv.to));
    if from_idx == 72 || to_idx == 72 {
        pos.castling_rights &= !RIGHT_WQ;
    }
    if from_idx == 80 || to_idx == 80 {
        pos.castling_rights &= !RIGHT_WK;
    }
    if from_idx == 0 || to_idx == 0 {
        pos.castling_rights &= !RIGHT_BQ;
    }
    if from_idx == 8 || to_idx == 8 {
        pos.castling_rights &= !RIGHT_BK;
    }

    pos.side_to_move = pos.side_to_move.opposite();
    pos.halfmove_clock += 1;
    if pos.side_to_move == Color::White {
        pos.fullmove_number += 1;
    }
}

/// Mirrors `unmake_move` (position.c:229-261).
pub fn unmake_move(pos: &mut EnginePosition, mv: &EngineMove) {
    let mut piece = pos.board.get(mv.to.r, mv.to.c).expect("unmake_move: no piece at to");
    if mv.is_promotion {
        piece.kind = PieceKind::Pawn;
    }
    pos.board.set(mv.from.r, mv.from.c, Some(piece));
    pos.board.set(mv.to.r, mv.to.c, mv.captured);

    if piece.kind == PieceKind::King && (mv.to.c as i32 - mv.from.c as i32).abs() == 2 {
        let r = mv.to.r;
        let kingside = mv.to.c > mv.from.c;
        let rook_from_c = if kingside { 8 } else { 0 };
        let rook_to_c = if kingside { 5 } else { 3 };
        let rook = pos.board.get(r, rook_to_c);
        pos.board.set(r, rook_from_c, rook);
        pos.board.set(r, rook_to_c, None);
    }

    pos.castling_rights = mv.old_castling_rights;

    pos.side_to_move = pos.side_to_move.opposite();
    pos.halfmove_clock -= 1;
    if pos.side_to_move == Color::Black {
        pos.fullmove_number -= 1;
    }
}

const PROMO_TYPES: [PieceKind; 4] = [PieceKind::Queen, PieceKind::Rook, PieceKind::Bishop, PieceKind::Knight];

fn plain(from: ESquare, to: ESquare, captured: Option<Piece>) -> EngineMove {
    EngineMove { from, to, captured, is_promotion: false, promotion_type: None, old_castling_rights: 0 }
}

/// Mirrors `generate_moves` (position.c:264-461): pseudo-legal (not yet
/// filtered for leaving one's own king in check).
pub fn generate_moves(pos: &EnginePosition) -> Vec<EngineMove> {
    let mut moves = Vec::new();
    let us = pos.side_to_move;
    let them = us.opposite();

    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            let piece = match pos.board.get(r, c) {
                Some(p) if p.color == us => p,
                _ => continue,
            };
            let from = ESquare { r, c };
            let ir = r as i32;
            let ic = c as i32;

            match piece.kind {
                PieceKind::Pawn => {
                    let dir: i32 = if us == Color::White { -1 } else { 1 };
                    let start_rank: i32 = if us == Color::White { 7 } else { 1 };
                    let promo_rank: i32 = if us == Color::White { 0 } else { 8 };

                    let tr = ir + dir;
                    if in_bounds(tr as isize, ic as isize) && pos.board.get(tr as usize, c).is_none() {
                        let to = ESquare { r: tr as usize, c };
                        if tr == promo_rank {
                            for &pt in &PROMO_TYPES {
                                moves.push(EngineMove {
                                    from,
                                    to,
                                    captured: None,
                                    is_promotion: true,
                                    promotion_type: Some(pt),
                                    old_castling_rights: 0,
                                });
                            }
                        } else {
                            moves.push(plain(from, to, None));
                        }

                        if ir == start_rank {
                            let tr2 = ir + 2 * dir;
                            if pos.board.get(tr2 as usize, c).is_none() {
                                moves.push(plain(from, ESquare { r: tr2 as usize, c }, None));
                            }
                        }
                    }

                    // **Confirmed bug in position.c, preserved bug-for-bug**:
                    // captures use `is_valid_square(to)` — which only checks
                    // the flat 0..81 range — instead of separately bounds-
                    // checking the file. An edge-file pawn (c=0 or c=8) with
                    // dc=-1/+1 can produce a flat index that "borrows" from
                    // an adjacent row, landing on a real but unrelated square
                    // one rank away at the opposite file. Verified against
                    // the real binary: after `a2a4 i8i6`, `legal` lists the
                    // phantom move `a4i6` (from (5,0), wrapping (4,-1) into
                    // flat index 35 = (3,8)) as a legal "capture" of the
                    // black pawn that just landed there. Every other piece
                    // type in position.c bounds-checks rank and file
                    // separately and does not have this bug — see the
                    // module doc.
                    for dc in [-1i32, 1] {
                        let to_flat = (ir + dir) * 9 + (ic + dc);
                        if (0..81).contains(&to_flat) {
                            let to = ESquare { r: (to_flat / 9) as usize, c: (to_flat % 9) as usize };
                            let tr = to.r as i32;
                            if let Some(captured) = pos.board.get(to.r, to.c) {
                                if captured.color == them && captured.kind != PieceKind::Krishna {
                                    if tr == promo_rank {
                                        for &pt in &PROMO_TYPES {
                                            moves.push(EngineMove {
                                                from,
                                                to,
                                                captured: Some(captured),
                                                is_promotion: true,
                                                promotion_type: Some(pt),
                                                old_castling_rights: 0,
                                            });
                                        }
                                    } else {
                                        moves.push(plain(from, to, Some(captured)));
                                    }
                                }
                            }
                        }
                    }
                }
                PieceKind::Knight => {
                    for (dr, dc) in KNIGHT_DIRS {
                        let (nr, nc) = (ir + dr, ic + dc);
                        if in_bounds(nr as isize, nc as isize) {
                            let to = ESquare { r: nr as usize, c: nc as usize };
                            let captured = pos.board.get(to.r, to.c);
                            match captured {
                                None => moves.push(plain(from, to, None)),
                                Some(cap) if cap.color == them && cap.kind != PieceKind::Krishna => {
                                    moves.push(plain(from, to, Some(cap)))
                                }
                                _ => {}
                            }
                        }
                    }
                }
                PieceKind::Bishop | PieceKind::Rook | PieceKind::Queen => {
                    let dirs: &[(i32, i32)] = match piece.kind {
                        PieceKind::Bishop => &BISHOP_DIRS,
                        PieceKind::Rook => &ROOK_DIRS,
                        _ => &[(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)],
                    };
                    for &(dr, dc) in dirs {
                        let (mut nr, mut nc) = (ir, ic);
                        loop {
                            nr += dr;
                            nc += dc;
                            if !in_bounds(nr as isize, nc as isize) {
                                break;
                            }
                            let to = ESquare { r: nr as usize, c: nc as usize };
                            match pos.board.get(to.r, to.c) {
                                None => moves.push(plain(from, to, None)),
                                Some(cap) => {
                                    if cap.color == them && cap.kind != PieceKind::Krishna {
                                        moves.push(plain(from, to, Some(cap)));
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
                PieceKind::King | PieceKind::Krishna => {
                    for (dr, dc) in KING_DIRS {
                        let (nr, nc) = (ir + dr, ic + dc);
                        if in_bounds(nr as isize, nc as isize) {
                            let to = ESquare { r: nr as usize, c: nc as usize };
                            let captured = pos.board.get(to.r, to.c);
                            if piece.kind == PieceKind::Krishna {
                                if captured.is_none() {
                                    moves.push(plain(from, to, None));
                                }
                            } else {
                                match captured {
                                    None => moves.push(plain(from, to, None)),
                                    Some(cap) if cap.color == them && cap.kind != PieceKind::Krishna => {
                                        moves.push(plain(from, to, Some(cap)))
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }

                    if piece.kind == PieceKind::King && !is_in_check(pos, us) {
                        let r_idx = if us == Color::White { 8 } else { 0 };
                        let (king_right, queen_right) = if us == Color::White {
                            (RIGHT_WK, RIGHT_WQ)
                        } else {
                            (RIGHT_BK, RIGHT_BQ)
                        };

                        if pos.castling_rights & king_right != 0 {
                            let rook = pos.board.get(r_idx, 8);
                            if matches!(rook, Some(p) if p.color == us && p.kind == PieceKind::Rook)
                                && pos.board.get(r_idx, 5).is_none()
                                && pos.board.get(r_idx, 6).is_none()
                                && !is_square_attacked(pos, ESquare { r: r_idx, c: 5 }, them)
                                && !is_square_attacked(pos, ESquare { r: r_idx, c: 6 }, them)
                            {
                                moves.push(plain(from, ESquare { r: r_idx, c: 6 }, None));
                            }
                        }

                        if pos.castling_rights & queen_right != 0 {
                            let rook = pos.board.get(r_idx, 0);
                            if matches!(rook, Some(p) if p.color == us && p.kind == PieceKind::Rook)
                                && pos.board.get(r_idx, 3).is_none()
                                && pos.board.get(r_idx, 2).is_none()
                                && pos.board.get(r_idx, 1).is_none()
                                && !is_square_attacked(pos, ESquare { r: r_idx, c: 3 }, them)
                                && !is_square_attacked(pos, ESquare { r: r_idx, c: 2 }, them)
                            {
                                moves.push(plain(from, ESquare { r: r_idx, c: 2 }, None));
                            }
                        }
                    }
                }
            }
        }
    }

    moves
}

/// Mirrors `generate_legal_moves` (position.c:464-482): filters
/// pseudo-legal moves by make/unmake + check test.
pub fn generate_legal_moves(pos: &mut EnginePosition) -> Vec<EngineMove> {
    let pseudo = generate_moves(pos);
    let mut legal = Vec::with_capacity(pseudo.len());
    for mut mv in pseudo {
        make_move(pos, &mut mv);
        let us = pos.side_to_move.opposite();
        if !is_in_check(pos, us) {
            legal.push(mv);
        }
        unmake_move(pos, &mv);
    }
    legal
}

const UCI_FILES: &[u8] = b"abcdefghi";

/// Mirrors `square_to_str` / `square_to_uci` (engine/uci.c:76-81) —
/// file a–i, rank = 9−row. **FROZEN** external contract.
pub fn square_to_uci(sq: ESquare) -> String {
    format!("{}{}", UCI_FILES[sq.c] as char, 9 - sq.r)
}

/// Mirrors `str_to_square` (engine/uci.c:84-98). Returns `None` when the
/// file is outside a–i (C returns -1).
pub fn uci_to_square(token: &str) -> Option<ESquare> {
    let bytes = token.as_bytes();
    if bytes.len() < 2 {
        return None;
    }
    let c = UCI_FILES.iter().position(|&f| f == bytes[0])?;
    let rank_digit = (bytes[1] as char).to_digit(10)?;
    let r = 9i32 - rank_digit as i32;
    if !(0..9).contains(&r) {
        return None;
    }
    Some(ESquare {
        r: r as usize,
        c,
    })
}

/// Encode an `EngineMove` as a UCI token, including underpromotion suffix
/// (`q`/`r`/`b`/`n`) when `is_promotion` — mirrors the `legal`/`bestmove`
/// formatting in engine/uci.c:178-242.
pub fn engine_move_to_uci(mv: &EngineMove) -> String {
    let mut s = format!("{}{}", square_to_uci(mv.from), square_to_uci(mv.to));
    if mv.is_promotion {
        let promo = match mv.promotion_type {
            Some(PieceKind::Rook) => 'r',
            Some(PieceKind::Bishop) => 'b',
            Some(PieceKind::Knight) => 'n',
            // C defaults unknown / QUEEN to 'q'
            _ => 'q',
        };
        s.push(promo);
    }
    s
}

/// Apply a UCI move token against the current legal move list, matching
/// C's `position startpos moves …` loop (engine/uci.c:139-158): from/to
/// must match, and for promotions the suffix char must equal the
/// generated promotion type (defaulting absent suffix to queen fails the
/// underpromotion candidates).
pub fn apply_uci_move(pos: &mut EnginePosition, token: &str) -> bool {
    let bytes = token.as_bytes();
    if bytes.len() < 4 {
        return false;
    }
    let Some(from) = uci_to_square(&token[..2]) else {
        return false;
    };
    let Some(to) = uci_to_square(&token[2..4]) else {
        return false;
    };
    let promo_char = bytes.get(4).copied().unwrap_or(0) as char;

    let mut legal = generate_legal_moves(pos);
    for mv in &mut legal {
        if mv.from != from || mv.to != to {
            continue;
        }
        if mv.is_promotion {
            let expected = match mv.promotion_type {
                Some(PieceKind::Rook) => 'r',
                Some(PieceKind::Bishop) => 'b',
                Some(PieceKind::Knight) => 'n',
                _ => 'q',
            };
            if promo_char != expected {
                continue;
            }
        }
        make_move(pos, mv);
        return true;
    }
    false
}
