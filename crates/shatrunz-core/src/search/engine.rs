//! Faithful port of `engine/search.c`, built on `engine_position` (the
//! C-specific move generator — rights-mode castling, underpromotion, and
//! the two confirmed check/pawn-capture bugs documented there, all
//! inherited transitively since this search calls into that move
//! generator exactly as the C code does).
//!
//! **One deliberate, documented non-bug-for-bug fix**: `search()` in the
//! real C code calls `alphabeta(pos, depth-1, INT_MIN, INT_MAX, 1)` —
//! `alphabeta`'s own recursive call then computes `-alpha`/`-beta`
//! *before* `alpha` has been narrowed from its initial `INT_MIN`, which
//! is signed-integer-overflow UB in C. This is not a stable bug like the
//! two in `engine_position` (which are deterministic and fully explained
//! by the move-generation logic) — it's UB whose manifestation depends on
//! how the compiler happens to generate code at each call site. Proven
//! empirically: a standalone harness that reimplements `search()`'s exact
//! loop body inline (calling the real, unmodified `alphabeta`/`order_moves`
//! from the shipped object file) produces a *uniformly corrupted* score
//! for every root move at depth 3, while a harness that instead calls the
//! real exported `search()` function directly reproduces the shipped
//! binary's actual (non-corrupted-looking) bestmove choice — both at
//! `-O0` and `-O3`. Since even hand-transcribing the identical algorithm
//! into a fresh translation unit changes the outcome, there is no stable
//! "real" bestmove to bit-match here for depth ≥ 2 — chasing it would
//! mean pinning a test to one specific compiler's incidental codegen,
//! liable to change on any rebuild. This port instead uses a large finite
//! sentinel (`INF`) instead of `i32::MIN`/`i32::MAX`, giving the
//! *intended* alpha-beta behavior (matching what the original author
//! clearly meant by "infinity" bounds) without the overflow. Depth 1 is
//! unaffected (quiescence's stand-pat check narrows `alpha` before any
//! negation occurs) and **is** parity-tested against the real binary,
//! confirmed stable across independent rebuilds.
//!
//! **Not ported**: the UCI `info depth ... score cp ...` printf side
//! effect (`emit_search_info`) — that's I/O, not search logic. Callers
//! (the UCI binary, M4) get an `on_info` callback instead, invoked with
//! exactly what C passes: `evaluate()` of the *current root position*
//! (not the search score the candidate move actually returned — a real
//! quirk of the C code, preserved here).

use crate::engine_position::{
    generate_legal_moves, is_in_check, make_move, unmake_move, EngineMove, EnginePosition,
};
use crate::eval::engine::evaluate;

const MATE_SCORE: i32 = 100_000;
/// Stands in for C's `INT_MIN`/`INT_MAX` at the root call — see module
/// doc for why literal `i32::MIN`/`i32::MAX` (matching C's `INT_MIN`/
/// `INT_MAX` exactly) is deliberately not used here.
const INF: i32 = 10_000_000;

/// Mirrors `order_moves` (search.c:41-54): a selection-sort-like nested
/// loop with in-place swaps on a binary capture/non-capture score. Ported
/// as the literal same algorithm (not a stable sort) because the exact
/// resulting order among non-captures is an emergent property of *this*
/// swap pattern, not just "captures first" — it affects alpha-beta tie-
/// breaking, per docs/RUST_PORT.md's "exact iteration order" discipline.
fn order_moves(moves: &mut [EngineMove]) {
    let count = moves.len();
    for i in 0..count.saturating_sub(1) {
        for j in (i + 1)..count {
            let score_i = if moves[i].captured.is_some() { 1000 } else { 0 };
            let score_j = if moves[j].captured.is_some() { 1000 } else { 0 };
            if score_j > score_i {
                moves.swap(i, j);
            }
        }
    }
}

/// Mirrors `move_gives_check` (search.c:56-62).
fn move_gives_check(pos: &mut EnginePosition, mv: &EngineMove) -> bool {
    let mut m = *mv;
    make_move(pos, &mut m);
    let victim = pos.side_to_move;
    let check = is_in_check(pos, victim);
    unmake_move(pos, &m);
    check
}

/// Mirrors `is_noisy_move` (search.c:64-69): captures or checks (using
/// `engine_position`'s buggy check detection, inherited as-is).
fn is_noisy_move(pos: &mut EnginePosition, mv: &EngineMove) -> bool {
    mv.captured.is_some() || move_gives_check(pos, mv)
}

/// Mirrors `terminal_score` (search.c:71-76).
fn terminal_score(pos: &EnginePosition, ply_offset: i32) -> i32 {
    if is_in_check(pos, pos.side_to_move) {
        (-MATE_SCORE).wrapping_add(ply_offset)
    } else {
        0
    }
}

/// Mirrors `quiescence` (search.c:78-114): captures-and-checks-only.
fn quiescence(pos: &mut EnginePosition, alpha: i32, beta: i32, ply: i32) -> i32 {
    let stand_pat = evaluate(&pos.board, pos.side_to_move);
    if stand_pat >= beta {
        return beta;
    }
    let mut alpha = alpha;
    if stand_pat > alpha {
        alpha = stand_pat;
    }

    let mut moves = generate_legal_moves(pos);
    if moves.is_empty() {
        return terminal_score(pos, ply);
    }
    order_moves(&mut moves);

    for m in moves {
        if !is_noisy_move(pos, &m) {
            continue;
        }
        let mut mv = m;
        make_move(pos, &mut mv);
        let score = quiescence(pos, beta.wrapping_neg(), alpha.wrapping_neg(), ply + 1).wrapping_neg();
        unmake_move(pos, &mv);
        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }
    alpha
}

/// Mirrors `alphabeta` (search.c:116-145).
fn alphabeta(pos: &mut EnginePosition, depth: i32, alpha: i32, beta: i32, ply: i32) -> i32 {
    if depth <= 0 {
        return quiescence(pos, alpha, beta, ply);
    }

    let mut moves = generate_legal_moves(pos);
    if moves.is_empty() {
        return terminal_score(pos, ply);
    }
    order_moves(&mut moves);

    let mut alpha = alpha;
    for m in moves {
        let mut mv = m;
        make_move(pos, &mut mv);
        let score = alphabeta(pos, depth - 1, beta.wrapping_neg(), alpha.wrapping_neg(), ply + 1).wrapping_neg();
        unmake_move(pos, &mv);
        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }
    alpha
}

/// Very small xorshift-style generator standing in for C's `rand()` —
/// only used when `randomness > 0`; not bit-reproducible against libc's
/// PRNG (no such contract exists) and not exercised by the deterministic
/// P3-analog parity gate, which always runs with `randomness = 0`.
struct SearchRng(u32);
impl SearchRng {
    fn next(&mut self) -> u32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        self.0
    }
}

/// Mirrors `search` (search.c:148-178): full-width search at a fixed
/// depth, returns the best move (or `None` for `Move{-1,...}`/no legal
/// moves).
pub fn search(pos: &mut EnginePosition, depth: i32, randomness: i32) -> Option<EngineMove> {
    let mut moves = generate_legal_moves(pos);
    if moves.is_empty() {
        return None;
    }
    order_moves(&mut moves);

    let mut best_move = moves[0];
    let mut best_score = i32::MIN;
    let mut rng = SearchRng(0x9E3779B9 ^ (depth as u32).wrapping_mul(2654435761));

    for m in &moves {
        let mut mv = *m;
        make_move(pos, &mut mv);
        let mut score = alphabeta(pos, depth - 1, -INF, INF, 1).wrapping_neg();
        unmake_move(pos, &mv);

        if randomness > 0 {
            let span = 2 * randomness + 1;
            let noise = (rng.next() % span as u32) as i32 - randomness;
            score = score.wrapping_add(noise);
        }

        if score > best_score {
            best_score = score;
            best_move = *m;
        }
    }

    Some(best_move)
}

/// Mirrors `search_timed` (search.c:180-212). `on_info` is called once
/// per depth that produces a move, with `(depth, evaluate(root), mv)` —
/// note the score is a fresh root-position static eval, **not** the
/// search score that move received (see module doc).
pub fn search_timed(
    pos: &mut EnginePosition,
    max_depth: i32,
    randomness: i32,
    time_ms: i32,
    mut on_info: impl FnMut(i32, i32, EngineMove),
) -> Option<EngineMove> {
    if time_ms <= 0 {
        return search(pos, if max_depth > 0 { max_depth } else { 5 }, randomness);
    }

    let start = std::time::Instant::now();
    let mut limit_sec = (time_ms as f64 / 1000.0) * 0.9;
    if limit_sec < 0.01 {
        limit_sec = 0.01;
    }

    let mut best_move: Option<EngineMove> = None;
    let cap = if max_depth > 0 { max_depth } else { 64 };

    for depth in 1..=cap {
        let candidate = search(pos, depth, randomness);
        if let Some(mv) = candidate {
            best_move = Some(mv);
            let score = evaluate(&pos.board, pos.side_to_move);
            on_info(depth, score, mv);
        }

        if start.elapsed().as_secs_f64() >= limit_sec {
            break;
        }
    }

    if best_move.is_none() {
        return search(pos, 1, randomness);
    }
    best_move
}
