//! Faithful port of `frontend/shared/eval_core.js`. Float parity is a
//! named risk in docs/plans/PLAN_03_rust_port.md: PST/material/mobility/
//! pawn-structure terms are integer in both JS and Rust, but capture
//! pressure and the weighted sum use f64 in the *exact same operation
//! order* as the JS `number` (IEEE754 binary64) arithmetic, then
//! `js_round = floor(x + 0.5)` — not Rust's round-half-away-from-zero.

use crate::board::{Board, BOARD_SIZE};
use crate::phase::{get_phase, Phase};
use crate::piece::{Color, PieceKind};
use crate::rules;

/// `Math.round(x)` mirrors `floor(x + 0.5)`, not round-half-to-even or
/// round-half-away-from-zero — e.g. `Math.round(-0.5) == -0`, whereas
/// Rust's `f64::round()` would give `-1`. Do not replace this with
/// `.round()`.
pub fn js_round(x: f64) -> i32 {
    (x + 0.5).floor() as i32
}

// The tables below transcribe eval_core.js's PST_* values verbatim, but
// `pst_for_piece` (further down) doesn't actually index into them — see
// its doc comment for why the real JS function is a no-op in practice.
// Kept, not deleted, as the documented "intended" values for the
// post-port fix-the-bug item deferred in docs/RUST_PORT.md.
#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
#[rustfmt::skip]
const PST_KING_MID: [i32; 81] = [
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 0, 10, 30, 20,
    20, 40, 20, 0, 0, 0, 20, 40, 20,
];

#[allow(dead_code)]
#[rustfmt::skip]
const PST_KING_END: [i32; 81] = [
    -10, -10, -10, -10, -10, -10, -10, -10, -10,
    -10, -10, -10, -10, -10, -10, -10, -10, -10,
    -10, -5, 0, 5, 5, 5, 0, -5, -10,
    -5, 0, 5, 10, 10, 10, 5, 0, -5,
    0, 5, 10, 15, 15, 15, 10, 5, 0,
    5, 10, 15, 20, 20, 20, 15, 10, 5,
    10, 15, 20, 25, 25, 25, 20, 15, 10,
    15, 20, 25, 30, 30, 30, 25, 20, 15,
    20, 25, 30, 35, 35, 35, 30, 25, 20,
];

#[allow(dead_code)]
#[rustfmt::skip]
const PST_KRISHNA: [i32; 81] = [
    -20, -20, -20, -20, -20, -20, -20, -20, -20,
    -10, 0, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 10, 10, 10, 10, 10, 0, -10,
    -10, 5, 10, 20, 40, 20, 10, 5, -10,
    -10, 5, 10, 20, 20, 20, 10, 5, -10,
    -10, 0, 10, 10, 10, 10, 10, 0, -10,
    -20, -10, 0, 0, 0, 0, 0, -10, -20,
    -30, -20, -10, -10, 0, -10, -10, -20, -30,
    -30, -20, -10, -10, 0, -10, -10, -20, -30,
];

/// **Confirmed live bug in eval_core.js, preserved here bug-for-bug.**
/// `pstForPiece` computes `idx = row*9 + c` (a flat 0-80 index, `row`
/// already color-mirrored) and looks it up as `PST_PAWN[idx] ?? 0` —
/// but `PST_PAWN`/`PST_KNIGHT`/`PST_KING_MID`/`PST_KING_END`/`PST_KRISHNA`
/// are 2D nested arrays (`[9][9]`), each only 9 elements long at the top
/// level. For every reachable `idx >= 9` (i.e. `row != 0`, true for
/// essentially every real position) `table[idx]` is `undefined` in JS, so
/// `?? 0` makes the entire piece-square term a no-op. Verified directly
/// against the live module:
/// `node -e "import('./frontend/shared/eval_core.js').then(m =>
/// console.log(m.PST_PAWN[71]))"` → `undefined` (idx 71 is r=7,c=8 — an
/// ordinary square, not some corner case).
///
/// The one case JS doesn't silently zero is `idx < 9` (`row === 0`,
/// i.e. a Pawn/Knight/King/Krishna sitting on the color-mirrored back
/// rank): there `PST_PAWN[idx]` returns a *row array*, and JS's
/// `score += pst` / `score -= pst` then coerces that array to a string
/// via `+`, corrupting `score` for the rest of the call (eventually
/// `Math.round(NaN)`). That corner is intentionally not reproduced
/// bit-for-bit — there's no clean number to replicate, and doing so would
/// mean modeling JS's dynamic-typing coercion for a case with no sane
/// semantics. See docs/RUST_PORT.md "Evaluation" for the full writeup and
/// FROZEN status of this behavior. Bishop/Rook/Queen's "center" term
/// below never touches these tables and is unaffected by any of this.
fn pst_for_piece(kind: PieceKind, _color: Color, r: usize, c: usize, _phase: Phase) -> i32 {
    match kind {
        PieceKind::Pawn | PieceKind::Knight | PieceKind::Krishna | PieceKind::King => 0,
        PieceKind::Bishop | PieceKind::Rook | PieceKind::Queen => {
            if r > 2 && r < 6 && c > 2 && c < 6 {
                8
            } else {
                0
            }
        }
    }
}

/// Material only: White − Black. Mirrors `evalMaterialBalance`
/// (eval_core.js:101-113).
pub fn eval_material_balance(board: &Board) -> i32 {
    let mut w = 0i32;
    let mut b = 0i32;
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                if p.color == Color::White {
                    w += p.kind.weight();
                } else {
                    b += p.kind.weight();
                }
            }
        }
    }
    w - b
}

/// Mirrors `evalPieceSquare` (eval_core.js:116-128).
pub fn eval_piece_square(board: &Board, phase: Phase) -> i32 {
    let mut score = 0i32;
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                let pst = pst_for_piece(p.kind, p.color, r, c, phase);
                if p.color == Color::White {
                    score += pst;
                } else {
                    score -= pst;
                }
            }
        }
    }
    score
}

/// Mirrors `evalMobility` (eval_core.js:131-144): legal move count per
/// piece (non-checking generation), ×3.
pub fn eval_mobility(board: &Board) -> i32 {
    let mut score = 0i32;
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                let n = rules::get_legal_moves(board, r, c, false).len() as i32;
                let bonus = n * 3;
                if p.color == Color::White {
                    score += bonus;
                } else {
                    score -= bonus;
                }
            }
        }
    }
    score
}

/// Mirrors `evalPawnStructure` (eval_core.js:147-184): isolated/doubled
/// file penalties.
pub fn eval_pawn_structure(board: &Board) -> i32 {
    let mut score = 0i32;
    for c in 0..BOARD_SIZE {
        let mut w_pawns = 0i32;
        let mut b_pawns = 0i32;
        for r in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                if p.kind == PieceKind::Pawn {
                    if p.color == Color::White {
                        w_pawns += 1;
                    } else {
                        b_pawns += 1;
                    }
                }
            }
        }
        if w_pawns > 1 {
            score -= 15 * (w_pawns - 1);
        }
        if b_pawns > 1 {
            score += 15 * (b_pawns - 1);
        }
        if w_pawns == 1 && is_isolated(board, c, Color::White) {
            score -= 20;
        }
        if b_pawns == 1 && is_isolated(board, c, Color::Black) {
            score += 20;
        }
    }
    score
}

fn is_isolated(board: &Board, c: usize, color: Color) -> bool {
    for nc in [c.checked_sub(1), Some(c + 1)].into_iter().flatten() {
        if nc >= BOARD_SIZE {
            continue;
        }
        for r in 0..BOARD_SIZE {
            if let Some(n) = board.get(r, nc) {
                if n.kind == PieceKind::Pawn && n.color == color {
                    return false;
                }
            }
        }
    }
    true
}

/// Capture pressure for the aggressive persona hook. Mirrors
/// `evalCapturePressure` (eval_core.js:187-204). Returns f64 — this term
/// feeds the weighted sum below in f64 before rounding, matching JS.
pub fn eval_capture_pressure(board: &Board) -> f64 {
    let mut score = 0.0f64;
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            let p = match board.get(r, c) {
                Some(p) => p,
                None => continue,
            };
            for m in rules::get_legal_moves(board, r, c, false) {
                let t = match board.get(m.r, m.c) {
                    Some(t) => t,
                    None => continue,
                };
                if t.kind == PieceKind::Krishna || t.color == p.color {
                    continue;
                }
                let cap = t.kind.weight() as f64 * 0.4;
                if p.color == Color::White {
                    score += cap;
                } else {
                    score -= cap;
                }
            }
        }
    }
    score
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Persona {
    Material,
    Positional,
    Aggressive,
}

#[derive(Debug, Clone, Copy)]
pub struct PersonaWeights {
    pub material: f64,
    pub pst: f64,
    pub mobility: f64,
    pub pawns: f64,
    pub tempo: f64,
    pub capture: Option<f64>,
}

/// Mirrors `PERSONA_WEIGHTS` (eval_core.js:206-210).
pub fn persona_weights(persona: Persona) -> PersonaWeights {
    match persona {
        Persona::Material => PersonaWeights {
            material: 1.0,
            pst: 0.35,
            mobility: 0.5,
            pawns: 0.4,
            tempo: 10.0,
            capture: None,
        },
        Persona::Positional => PersonaWeights {
            material: 1.0,
            pst: 1.0,
            mobility: 1.0,
            pawns: 0.8,
            tempo: 0.0,
            capture: None,
        },
        Persona::Aggressive => PersonaWeights {
            material: 0.85,
            pst: 0.4,
            mobility: 1.2,
            pawns: 0.3,
            tempo: 35.0,
            capture: Some(1.0),
        },
    }
}

/// Full position evaluation, always White-positive (display/analysis).
/// Mirrors `evaluatePositionWhite` (eval_core.js:215-229) — op order
/// preserved for f64 bit-parity.
pub fn evaluate_position_white(board: &Board, persona: Persona) -> i32 {
    let phase = get_phase(board);
    let w = persona_weights(persona);

    let mut score = eval_material_balance(board) as f64 * w.material;
    score += eval_piece_square(board, phase) as f64 * w.pst;
    score += eval_mobility(board) as f64 * w.mobility;
    score += eval_pawn_structure(board) as f64 * w.pawns;

    if let Some(capture_w) = w.capture {
        score += eval_capture_pressure(board) * capture_w;
    }

    js_round(score)
}

/// Negamax leaf evaluation: score relative to side to move. Mirrors
/// `evaluateForSearch` (eval_core.js:232-239).
pub fn evaluate_for_search(board: &Board, turn: Color, persona: Persona) -> i32 {
    let mut score = evaluate_position_white(board, persona);
    let w = persona_weights(persona);
    if w.tempo != 0.0 {
        // Persona tempo values (10, 0, 35) are always whole numbers.
        let tempo = w.tempo as i32;
        score += if turn == Color::White { tempo } else { -tempo };
    }
    if turn == Color::White {
        score
    } else {
        -score
    }
}

/// Mate/game-over display score (White-positive). Mirrors
/// `evaluateGameOverDisplay` (eval_core.js:242-246).
pub fn evaluate_game_over_display(winner: Option<Color>) -> i32 {
    match winner {
        Some(Color::White) => 10000,
        Some(Color::Black) => -10000,
        None => 0,
    }
}
