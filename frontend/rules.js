import { BOARD_SIZE, COLORS, PIECES } from './constants.js';

export class Rules {
    static isWithinBounds(r, c) { return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }

    static getLegalMoves(boardState, r, c, checkKingSafety = true) {
        const piece = boardState[r][c];
        if (!piece) return [];
        let moves = [];
        const type = piece.type;
        const color = piece.color;
        const forward = color === COLORS.WHITE ? -1 : 1;

        if (type === PIECES.PAWN) {
            if (Rules.isWithinBounds(r + forward, c) && !boardState[r + forward][c]) {
                moves.push({ r: r + forward, c: c });
                const startRank = color === COLORS.WHITE ? 7 : 1;
                if (r === startRank && !boardState[r + (forward * 2)][c] && !boardState[r + forward][c]) {
                    moves.push({ r: r + (forward * 2), c: c });
                }
            }
            [[forward, -1], [forward, 1]].forEach(offset => {
                const tr = r + offset[0], tc = c + offset[1];
                if (Rules.isWithinBounds(tr, tc)) {
                    const target = boardState[tr][tc];
                    if (target && target.color !== color) moves.push({ r: tr, c: tc });
                }
            });
        }
        else if ([PIECES.ROOK, PIECES.BISHOP, PIECES.QUEEN].includes(type)) {
            const directions = [];
            if (type !== PIECES.BISHOP) directions.push([0, 1], [0, -1], [1, 0], [-1, 0]);
            if (type !== PIECES.ROOK) directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
            directions.forEach(dir => {
                for (let i = 1; i < BOARD_SIZE; i++) {
                    const tr = r + (dir[0] * i), tc = c + (dir[1] * i);
                    if (!Rules.isWithinBounds(tr, tc)) break;
                    const target = boardState[tr][tc];
                    if (!target) moves.push({ r: tr, c: tc });
                    else { if (target.color !== color) moves.push({ r: tr, c: tc }); break; }
                }
            });
        }
        else { // Knight, King, Krishna
            let offsets = (type === PIECES.KNIGHT)
                ? [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
                : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

            offsets.forEach(off => {
                const tr = r + off[0], tc = c + off[1];
                if (Rules.isWithinBounds(tr, tc)) {
                    const target = boardState[tr][tc];
                    if (type === PIECES.KRISHNA) { if (!target) moves.push({ r: tr, c: tc }); }
                    else if (!target || target.color !== color) moves.push({ r: tr, c: tc });
                }
            });
        }

        moves = moves.filter(m => {
            const t = boardState[m.r][m.c];
            return !(t && t.type === PIECES.KRISHNA);
        });

        if (checkKingSafety) {
            moves = moves.filter(m => {
                const savedTarget = boardState[m.r][m.c];
                const savedSource = boardState[r][c];
                boardState[m.r][m.c] = savedSource;
                boardState[r][c] = null;
                const inCheck = Rules.isKingInCheck(boardState, color);
                boardState[r][c] = savedSource;
                boardState[m.r][m.c] = savedTarget;
                return !inCheck;
            });
        }
        return moves;
    }

    static isKingInCheck(board, color) {
        let kR, kC;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] && board[r][c].color === color && board[r][c].type === PIECES.KING) {
                    kR = r; kC = c; break;
                }
            }
        }
        if (kR === undefined) return true;
        const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // Check Rays
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (let dir of dirs) {
            for (let i = 1; i < BOARD_SIZE; i++) {
                const tr = kR + (dir[0] * i), tc = kC + (dir[1] * i);
                if (!Rules.isWithinBounds(tr, tc)) break;
                const p = board[tr][tc];
                if (p) {
                    if (p.color === enemyColor) {
                        const t = p.type;
                        if (t === PIECES.KRISHNA) break;
                        const isOrtho = (dir[0] === 0 || dir[1] === 0);
                        if (isOrtho && (t === PIECES.ROOK || t === PIECES.QUEEN)) return true;
                        if (!isOrtho && (t === PIECES.BISHOP || t === PIECES.QUEEN)) return true;
                        if (i === 1 && t === PIECES.KING) return true;
                        if (i === 1 && !isOrtho && t === PIECES.PAWN) {
                            if (enemyColor === COLORS.WHITE && dir[0] === 1) return true;
                            if (enemyColor === COLORS.BLACK && dir[0] === -1) return true;
                        }
                    }
                    break;
                }
            }
        }
        // Check Knights
        const knightOffsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (let off of knightOffsets) {
            const tr = kR + off[0], tc = kC + off[1];
            if (Rules.isWithinBounds(tr, tc)) {
                const p = board[tr][tc];
                if (p && p.color === enemyColor && p.type === PIECES.KNIGHT) return true;
            }
        }
        return false;
    }
}
