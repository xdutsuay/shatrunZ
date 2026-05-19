/** Opening-book style lookup from brain memory (phase-aware). */

import { PHASE, getPhase } from './game_phase.js';

const OPENING_VISIT_THRESHOLD = 3;

/**
 * If opening phase and brain has strong memory for a move, return bonus.
 */
export function openingBookBonus(brain, hash, moveStr, game) {
    if (!brain || getPhase(game) !== PHASE.OPENING) return 0;
    const mem = brain.memory[hash];
    if (!mem || !mem[moveStr]) return 0;
    const visits = mem[moveStr];
    if (visits < OPENING_VISIT_THRESHOLD) return 0;
    return Math.min(visits * 0.15, 2.0);
}

export function endgameDepthBonus(game) {
    return getPhase(game) === PHASE.ENDGAME ? 1 : 0;
}
