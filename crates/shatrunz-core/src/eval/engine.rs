//! Faithful port of `engine/evaluate.c`'s `evaluate()` (the only function
//! of the two it exports that's actually wired to the UCI `eval` command —
//! `evaluate_material` is dead code in the C engine and is intentionally
//! not ported; see docs/RUST_PORT.md "Evaluation"). Deliberately diverges
//! from `eval::hce`: material + PST only, no mobility/pawn-structure/
//! capture-pressure terms, and only pawn/knight/krishna/king get PST
//! ("Add others... skip for now to save space" per the original C comment)
//! — this JS/C eval divergence is preserved, not unified, per the port's
//! "bug-for-bug" discipline.

use crate::board::{Board, BOARD_SIZE};
use crate::piece::{Color, PieceKind};

#[rustfmt::skip]
const PST_PAWN: [i32; 81] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 30, 25, 10, 5, 5,
    0, 0, 0, 20, 25, 20, 0, 0, 0,
    5, -5, -10, 0, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
];

#[rustfmt::skip]
const PST_KNIGHT: [i32; 81] = [
    -50, -40, -30, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -30, -40, -50,
    -50, -40, -30, -30, -30, -30, -30, -40, -50,
];

/// C engine has a single King PST (no midgame/endgame split) — unlike
/// `eval::hce`, which switches on phase. Preserved as its own divergence.
/// Note row 8 here (`20,30,10,...`) is *not* the same as JS's
/// `PST_KING_MID` row 8 (`20,40,20,...`) — evaluate.c:68-75 is a flat
/// 81-int literal broken across source lines that don't align to 9-wide
/// rows, so this was extracted programmatically (`python3 -c` parsing the
/// literal) rather than hand-transcribed, specifically to avoid silently
/// copying the JS table's row 8 by mistake.
#[rustfmt::skip]
const PST_KING: [i32; 81] = [
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 0, 10, 30, 20,
    20, 30, 10, 0, 0, 0, 10, 30, 20,
];

/// Not the same table as `eval::hce`'s `PST_KRISHNA`: the center bonus
/// ("Center E5 massive bonus") sits on row 3 in JS but row 4 here — a
/// real JS/C divergence, extracted programmatically from evaluate.c's
/// flat literal (same reason as `PST_KING` above) rather than assumed
/// identical to the JS table.
#[rustfmt::skip]
const PST_KRISHNA: [i32; 81] = [
    -20, -20, -20, -20, -20, -20, -20, -20, -20,
    -10, 0, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 10, 10, 10, 10, 10, 0, -10,
    -10, 5, 10, 20, 20, 20, 10, 5, -10,
    -10, 5, 10, 20, 40, 20, 10, 5, -10,
    -10, 5, 10, 20, 20, 20, 10, 5, -10,
    -10, 0, 10, 10, 10, 10, 10, 0, -10,
    -20, -10, 0, 0, 0, 0, 0, -10, -20,
    -30, -20, -10, -10, 0, -10, -10, -20, -30,
];

fn pst_val(kind: PieceKind, color: Color, r: usize, c: usize) -> i32 {
    let idx = if color == Color::White { r * 9 + c } else { (8 - r) * 9 + c };
    match kind {
        PieceKind::Pawn => PST_PAWN[idx],
        PieceKind::Knight => PST_KNIGHT[idx],
        PieceKind::Krishna => PST_KRISHNA[idx],
        PieceKind::King => PST_KING[idx],
        PieceKind::Bishop | PieceKind::Rook | PieceKind::Queen => 0,
    }
}

/// Mirrors `evaluate()` (evaluate.c:78-116): material + PST, returned from
/// `side_to_move`'s perspective (negated for Black), all-integer
/// arithmetic (no float parity concerns here, unlike `eval::hce`).
pub fn evaluate(board: &Board, side_to_move: Color) -> i32 {
    let mut score = 0i32;
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                let value = p.kind.weight() + pst_val(p.kind, p.color, r, c);
                if p.color == Color::White {
                    score += value;
                } else {
                    score -= value;
                }
            }
        }
    }
    if side_to_move == Color::White {
        score
    } else {
        -score
    }
}
