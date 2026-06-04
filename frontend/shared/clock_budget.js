import { COLORS } from '../constants.js';

// Never plan to spend more than this fraction of the remaining clock on one move,
// and always keep a small reserve so a single move cannot drive the clock to zero
// (covers move application / rendering / scheduling overhead after the search).
const MAX_FRACTION = 0.4;
const RESERVE_MS = 150;
const MIN_BUDGET_MS = 50;

/** Mirror engine/uci.c compute_go_time_ms for JS engine budget. */
export function computeGoTimeMs({ wtime, btime, winc = 0, binc = 0, side }) {
    if (wtime <= 0 && btime <= 0) return 0;
    let remaining = side === COLORS.WHITE ? wtime : btime;
    let inc = side === COLORS.WHITE ? winc : binc;
    if (remaining <= 0) {
        remaining = side === COLORS.WHITE ? btime : wtime;
        inc = side === COLORS.WHITE ? binc : winc;
    }
    if (remaining <= 0) return 0;

    // Base share of the clock plus most (not all) of the increment we get back.
    let budget = Math.floor(remaining / 20) + Math.floor(inc * 0.8);

    // Hard safety: a single move may not consume more than MAX_FRACTION of the clock.
    // This is what prevents "burn the whole clock on the first move" when the
    // increment is large or time is low.
    const cap = Math.floor(remaining * MAX_FRACTION);
    if (budget > cap) budget = cap;

    // Always leave a reserve; in severe time pressure just move near-instantly.
    const usable = remaining - RESERVE_MS;
    if (usable <= 0) return MIN_BUDGET_MS;
    if (budget > usable) budget = usable;
    if (budget < MIN_BUDGET_MS) budget = MIN_BUDGET_MS;
    return budget;
}

export function clockFieldsForSide(clock, side, incrementMs = 0) {
    return {
        wtime: Math.max(0, Math.floor(clock?.whiteMs ?? 0)),
        btime: Math.max(0, Math.floor(clock?.blackMs ?? 0)),
        winc: incrementMs,
        binc: incrementMs,
        side,
    };
}
