/** Game phase from material count (bell-curve motivation for branching). */

import { PIECES } from '../constants.js';
import { Rules } from '../rules.js';

export const PHASE = {
    OPENING: 'opening',
    MIDDLEGAME: 'middlegame',
    ENDGAME: 'endgame',
};

/** Krishna is immobile for capture logic but occupies a square — excluded from "material" count. */
export function countNonKrishnaPieces(board) {
    let n = 0;
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            const p = board[r][c];
            if (p && p.type !== PIECES.KRISHNA) n++;
        }
    }
    return n;
}

export function getPhase(game, opts = {}) {
    const openingMin = opts.openingMinPieces ?? 26;
    const endgameMax = opts.endgameMaxPieces ?? 7;
    const n = countNonKrishnaPieces(game.board);
    if (n >= openingMin) return PHASE.OPENING;
    if (n <= endgameMax) return PHASE.ENDGAME;
    return PHASE.MIDDLEGAME;
}

/** Legal-move count for side to move (proxy for branching factor). */
export function estimateBranchingFactor(game) {
    return Rules.getAllLegalMoves(game.board, game.turn).length;
}

export function phaseSnapshot(game) {
    const pieces = countNonKrishnaPieces(game.board);
    const legal = estimateBranchingFactor(game);
    return {
        phase: getPhase(game),
        nonKrishnaPieces: pieces,
        legalMoves: legal,
    };
}
