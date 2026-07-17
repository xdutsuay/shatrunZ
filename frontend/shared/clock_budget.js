/**
 * Thin clock-budget adapter — prefers wasm `clockBudgetMs`, falls back to
 * the original integer formula when wasm is not initialized (tests).
 */

import { COLORS } from '../constants.js';
import { isWasmReady, getWasm } from './wasm_boot.js';

const MAX_FRACTION = 0.4;
const RESERVE_MS = 150;
const MIN_BUDGET_MS = 50;

function computeGoTimeMsJs({ wtime, btime, winc = 0, binc = 0, side }) {
    if (wtime <= 0 && btime <= 0) return 0;
    let remaining = side === COLORS.WHITE ? wtime : btime;
    let inc = side === COLORS.WHITE ? winc : binc;
    if (remaining <= 0) {
        remaining = side === COLORS.WHITE ? btime : wtime;
        inc = side === COLORS.WHITE ? binc : winc;
    }
    if (remaining <= 0) return 0;

    let budget = Math.floor(remaining / 20) + Math.floor(inc * 0.8);
    const cap = Math.floor(remaining * MAX_FRACTION);
    if (budget > cap) budget = cap;
    const usable = remaining - RESERVE_MS;
    if (usable <= 0) return MIN_BUDGET_MS;
    if (budget > usable) budget = usable;
    if (budget < MIN_BUDGET_MS) budget = MIN_BUDGET_MS;
    return budget;
}

/** Mirror engine/uci.c compute_go_time_ms for JS engine budget. */
export function computeGoTimeMs({ wtime, btime, winc = 0, binc = 0, side }) {
    if (isWasmReady()) {
        try {
            const { clockBudgetMs } = getWasm();
            return Number(clockBudgetMs(wtime, btime, side, side === COLORS.WHITE ? winc : binc));
        } catch {
            /* fall through */
        }
    }
    return computeGoTimeMsJs({ wtime, btime, winc, binc, side });
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
