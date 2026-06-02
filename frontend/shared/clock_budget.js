import { COLORS } from '../constants.js';

/** Mirror engine/uci.c compute_go_time_ms for JS engine budget. */
export function computeGoTimeMs({ wtime, btime, winc = 0, binc = 0, side }) {
    if (wtime <= 0 && btime <= 0) return 0;
    let remaining = side === COLORS.WHITE ? wtime : btime;
    let inc = side === COLORS.WHITE ? winc : binc;
    if (remaining <= 0) {
        remaining = side === COLORS.WHITE ? btime : wtime;
        inc = side === COLORS.WHITE ? binc : winc;
    }
    let budget = Math.floor(remaining / 20) + inc;
    if (budget < 50) budget = 50;
    if (budget > remaining && remaining > 0) budget = remaining;
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
