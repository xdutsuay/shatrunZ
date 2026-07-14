//! Faithful port of `frontend/shared/clock_budget.js`, which is itself a
//! JS mirror of `engine/uci.c`'s `compute_go_time_ms` — both engines share
//! this one budget formula, so this single Rust implementation is the
//! parity target for both UCI (`shatrunz-engine`, M4) and the persona
//! search (`search::persona`). All-integer arithmetic; no float-parity
//! concerns here (see docs/RUST_PORT.md "Search").

use crate::piece::Color;

/// Never plan to spend more than this fraction of the remaining clock on
/// one move (0.4 = 2/5, matching `engine/uci.c`'s literal `(remaining*2)/5`
/// integer division exactly — JS's `Math.floor(remaining * 0.4)` agrees
/// with this for all non-negative integers).
const MAX_FRACTION_NUM: i64 = 2;
const MAX_FRACTION_DEN: i64 = 5;
const RESERVE_MS: i64 = 150;
const MIN_BUDGET_MS: i64 = 50;

#[derive(Debug, Clone, Copy)]
pub struct ClockBudgetInput {
    pub wtime: i64,
    pub btime: i64,
    pub winc: i64,
    pub binc: i64,
    pub side: Color,
}

/// Mirrors `computeGoTimeMs` (clock_budget.js:11-36) /
/// `compute_go_time_ms` (engine/uci.c:29-...).
pub fn compute_go_time_ms(input: ClockBudgetInput) -> i64 {
    if input.wtime <= 0 && input.btime <= 0 {
        return 0;
    }

    let (mut remaining, mut inc) = if input.side == Color::White {
        (input.wtime, input.winc)
    } else {
        (input.btime, input.binc)
    };
    if remaining <= 0 {
        (remaining, inc) = if input.side == Color::White {
            (input.btime, input.binc)
        } else {
            (input.wtime, input.winc)
        };
    }
    if remaining <= 0 {
        return 0;
    }

    // Base share of the clock plus most (not all) of the increment we get back.
    let mut budget = remaining / 20 + (inc * 4) / 5;

    // Hard safety: a single move may not consume more than MAX_FRACTION of
    // the clock — prevents "burn the whole clock on the first move" when
    // increment is large or time is low.
    let cap = (remaining * MAX_FRACTION_NUM) / MAX_FRACTION_DEN;
    if budget > cap {
        budget = cap;
    }

    // Always leave a reserve; in severe time pressure just move near-instantly.
    let usable = remaining - RESERVE_MS;
    if usable <= 0 {
        return MIN_BUDGET_MS;
    }
    if budget > usable {
        budget = usable;
    }
    if budget < MIN_BUDGET_MS {
        budget = MIN_BUDGET_MS;
    }
    budget
}

/// Mirrors `clockFieldsForSide` (clock_budget.js:38-46).
pub fn clock_fields_for_side(white_ms: i64, black_ms: i64, side: Color, increment_ms: i64) -> ClockBudgetInput {
    ClockBudgetInput {
        wtime: white_ms.max(0),
        btime: black_ms.max(0),
        winc: increment_ms,
        binc: increment_ms,
        side,
    }
}
