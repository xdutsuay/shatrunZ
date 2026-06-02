/**
 * Shared hand-crafted evaluation (HCE) for ShatrunZ 9×9.
 * All helpers accumulate White − Black; use evaluateForSearch() for negamax (side-to-move).
 * @see https://www.chessprogramming.org/Evaluation
 */

import { BOARD_SIZE, COLORS, PIECES, WEIGHTS } from '../constants.js';
import { Rules } from '../rules.js';
import { countNonKrishnaPieces, PHASE } from './game_phase.js';

/** Pawn PST (rank 0 = top / black promotion side). Mirrors engine/evaluate.c */
export const PST_PAWN = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 30, 25, 10, 5, 5],
    [0, 0, 0, 20, 25, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export const PST_KNIGHT = [
    [-50, -40, -30, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -30, -40, -50],
    [-50, -40, -30, -30, -30, -30, -30, -40, -50],
];

export const PST_KING_MID = [
    [-30, -40, -40, -50, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 0, 10, 30, 20],
    [20, 40, 20, 0, 0, 0, 20, 40, 20],
];

export const PST_KING_END = [
    [-10, -10, -10, -10, -10, -10, -10, -10, -10],
    [-10, -10, -10, -10, -10, -10, -10, -10, -10],
    [-10, -5, 0, 5, 5, 5, 0, -5, -10],
    [-5, 0, 5, 10, 10, 10, 5, 0, -5],
    [0, 5, 10, 15, 15, 15, 10, 5, 0],
    [5, 10, 15, 20, 20, 20, 15, 10, 5],
    [10, 15, 20, 25, 25, 25, 20, 15, 10],
    [15, 20, 25, 30, 30, 30, 25, 20, 15],
    [20, 25, 30, 35, 35, 35, 30, 25, 20],
];

export const PST_KRISHNA = [
    [-20, -20, -20, -20, -20, -20, -20, -20, -20],
    [-10, 0, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 10, 10, 10, 10, 10, 0, -10],
    [-10, 5, 10, 20, 40, 20, 10, 5, -10],
    [-10, 5, 10, 20, 20, 20, 10, 5, -10],
    [-10, 0, 10, 10, 10, 10, 10, 0, -10],
    [-20, -10, 0, 0, 0, 0, 0, -10, -20],
    [-30, -20, -10, -10, 0, -10, -10, -20, -30],
    [-30, -20, -10, -10, 0, -10, -10, -20, -30],
];

export function inferPhase(board) {
    const n = countNonKrishnaPieces(board);
    if (n >= 26) return PHASE.OPENING;
    if (n <= 7) return PHASE.ENDGAME;
    return PHASE.MIDDLEGAME;
}

function pstIndex(p, r, c) {
    const row = p.color === COLORS.WHITE ? r : (8 - r);
    return row * BOARD_SIZE + c;
}

function pstForPiece(p, r, c, phase) {
    const idx = pstIndex(p, r, c);
    if (p.type === PIECES.PAWN) return PST_PAWN[idx] ?? 0;
    if (p.type === PIECES.KNIGHT) return PST_KNIGHT[idx] ?? 0;
    if (p.type === PIECES.KRISHNA) return PST_KRISHNA[idx] ?? 0;
    if (p.type === PIECES.KING) {
        const table = phase === PHASE.ENDGAME ? PST_KING_END : PST_KING_MID;
        return table[idx] ?? 0;
    }
    const center = (r > 2 && r < 6 && c > 2 && c < 6) ? 8 : 0;
    if (p.type === PIECES.BISHOP || p.type === PIECES.ROOK || p.type === PIECES.QUEEN) {
        return center;
    }
    return 0;
}

/** Material only: White − Black (centipawn scale from WEIGHTS). */
export function evalMaterialBalance(board) {
    let w = 0;
    let b = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (!p) continue;
            if (p.color === COLORS.WHITE) w += WEIGHTS[p.type];
            else b += WEIGHTS[p.type];
        }
    }
    return w - b;
}

/** Piece-square + material on pieces (PST layered on top of material in HCE style). */
export function evalPieceSquare(board, phase = PHASE.MIDDLEGAME) {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (!p) continue;
            const pst = pstForPiece(p, r, c, phase);
            if (p.color === COLORS.WHITE) score += pst;
            else score -= pst;
        }
    }
    return score;
}

/** Mobility: legal move count per piece (non-checking generation). */
export function evalMobility(board) {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (!p) continue;
            const n = Rules.getLegalMoves(board, r, c, false).length;
            const bonus = n * 3;
            if (p.color === COLORS.WHITE) score += bonus;
            else score -= bonus;
        }
    }
    return score;
}

/** Pawn structure: isolated / doubled file penalties (9 files). */
export function evalPawnStructure(board) {
    let score = 0;
    for (let c = 0; c < BOARD_SIZE; c++) {
        let wPawns = 0;
        let bPawns = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
            const p = board[r][c];
            if (!p || p.type !== PIECES.PAWN) continue;
            if (p.color === COLORS.WHITE) wPawns++;
            else bPawns++;
        }
        if (wPawns > 1) score -= 15 * (wPawns - 1);
        if (bPawns > 1) score += 15 * (bPawns - 1);
        if (wPawns === 1) {
            let isolated = true;
            for (const nc of [c - 1, c + 1]) {
                if (nc < 0 || nc >= BOARD_SIZE) continue;
                for (let r = 0; r < BOARD_SIZE; r++) {
                    const n = board[r][nc];
                    if (n?.type === PIECES.PAWN && n.color === COLORS.WHITE) isolated = false;
                }
            }
            if (isolated) score -= 20;
        }
        if (bPawns === 1) {
            let isolated = true;
            for (const nc of [c - 1, c + 1]) {
                if (nc < 0 || nc >= BOARD_SIZE) continue;
                for (let r = 0; r < BOARD_SIZE; r++) {
                    const n = board[r][nc];
                    if (n?.type === PIECES.PAWN && n.color === COLORS.BLACK) isolated = false;
                }
            }
            if (isolated) score += 20;
        }
    }
    return score;
}

/** Capture pressure for aggressive persona hook. */
export function evalCapturePressure(board) {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (!p) continue;
            const moves = Rules.getLegalMoves(board, r, c, false);
            for (const m of moves) {
                const t = board[m.r][m.c];
                if (!t || t.type === PIECES.KRISHNA || t.color === p.color) continue;
                const cap = WEIGHTS[t.type] * 0.4;
                if (p.color === COLORS.WHITE) score += cap;
                else score -= cap;
            }
        }
    }
    return score;
}

export const PERSONA_WEIGHTS = {
    material: { material: 1.0, pst: 0.35, mobility: 0.5, pawns: 0.4, tempo: 10 },
    positional: { material: 1.0, pst: 1.0, mobility: 1.0, pawns: 0.8, tempo: 0 },
    aggressive: { material: 0.85, pst: 0.4, mobility: 1.2, pawns: 0.3, tempo: 35, capture: 1.0 },
};

/**
 * Full position evaluation, always White-positive (display / analysis).
 */
export function evaluatePositionWhite(board, personaKey = 'material') {
    const phase = inferPhase(board);
    const w = PERSONA_WEIGHTS[personaKey] ?? PERSONA_WEIGHTS.material;

    let score = evalMaterialBalance(board) * w.material;
    score += evalPieceSquare(board, phase) * w.pst;
    score += evalMobility(board) * w.mobility;
    score += evalPawnStructure(board) * w.pawns;

    if (w.capture) {
        score += evalCapturePressure(board) * w.capture;
    }

    return Math.round(score);
}

/** Negamax leaf evaluation: score relative to side to move. */
export function evaluateForSearch(board, turn, personaKey = 'material') {
    let score = evaluatePositionWhite(board, personaKey);
    const w = PERSONA_WEIGHTS[personaKey] ?? PERSONA_WEIGHTS.material;
    if (w.tempo) {
        score += turn === COLORS.WHITE ? w.tempo : -w.tempo;
    }
    return turn === COLORS.WHITE ? score : -score;
}

/** Mate / game-over display score (White-positive). */
export function evaluateGameOverDisplay(winner) {
    if (winner === COLORS.WHITE) return 10000;
    if (winner === COLORS.BLACK) return -10000;
    return 0;
}
