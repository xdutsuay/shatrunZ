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

            // Castling Logic (Standard King moves 2 squares)
            if (type === PIECES.KING && !Rules.isKingInCheck(boardState, color)) {
                // Ensure King hasn't moved (need history? For now assuming if at start pos + castling rights logic handle it.
                // Since frontend doesn't track detailed history in this static method, we rely on the board state.
                // We'll assume if King is at Home and Rooks are at Home, castling IS possible if path clear.
                // TODO: Pass 'hasMoved' flags for strict adherence. For now, strict position check.

                const rank = (color === COLORS.WHITE) ? 7 : 0; // Visual Board: White row 7 (index 7? No, Board Size 9. Rows 0-8. White at 8?)
                // Helper: Constants says White is 'w'.
                // UI renders top-down: 0 is top (Black), 8 is bottom (White).
                // So White Rank is 8. Black Rank is 0.
                const kingRank = (color === COLORS.WHITE) ? 8 : 0;

                if (r === kingRank && c === 4) { // King at E (index 4)

                    // Kingside (Target G: index 6)
                    // Path: F(5), G(6) must be empty (Z is at G normally! So Z must move)
                    // Rook at I (index 8).
                    if (boardState[kingRank][5] === null && boardState[kingRank][6] === null) {
                        // Check rook existence (lazy verify rights)
                        if (boardState[kingRank][8] && boardState[kingRank][8].type === PIECES.ROOK && boardState[kingRank][8].color === color) {
                            if (!Rules.isSquareAttacked(boardState, kingRank, 5, color) &&
                                !Rules.isSquareAttacked(boardState, kingRank, 6, color)) {
                                moves.push({ r: kingRank, c: 6, isCastling: true, side: 'k' });
                            }
                        }
                    }

                    // Queenside (Target C: index 2)
                    // Path: D(3), C(2), B(1) must be empty.
                    // Rook at A (index 0).
                    if (boardState[kingRank][3] === null && boardState[kingRank][2] === null && boardState[kingRank][1] === null) {
                        if (boardState[kingRank][0] && boardState[kingRank][0].type === PIECES.ROOK && boardState[kingRank][0].color === color) {
                            if (!Rules.isSquareAttacked(boardState, kingRank, 3, color) &&
                                !Rules.isSquareAttacked(boardState, kingRank, 2, color)) {
                                moves.push({ r: kingRank, c: 2, isCastling: true, side: 'q' });
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    static isSquareAttacked(board, r, c, allyColor) {
        // Simple check: pretend we have a king there and see if checked
        // Requires refactoring isKingInCheck to take coords, or just temporary placement
        // But isKingInCheck finds the king.
        // Let's implement a lighter `isSquareAttacked` or reuse.
        // Hack: temporarily place a King of allyColor there?
        // But remove the real king?
        // Proper way: Iterate all enemy pieces and see if they attack (r,c).
        // Reuse logic from engine?
        // For simplicity:
        // Check Knight attacks
        // Check Ray attacks
        // Check Pawn attacks
        const enemyColor = allyColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // Knights
        const knights = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (let off of knights) {
            const tr = r + off[0], tc = c + off[1];
            if (Rules.isWithinBounds(tr, tc)) {
                const p = board[tr][tc];
                if (p && p.color === enemyColor && p.type === PIECES.KNIGHT) return true;
            }
        }
        // Rays
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (let dir of dirs) {
            for (let i = 1; i < BOARD_SIZE; i++) {
                const tr = r + (dir[0] * i), tc = c + (dir[1] * i);
                if (!Rules.isWithinBounds(tr, tc)) break;
                const p = board[tr][tc];
                if (p) {
                    if (p.color === enemyColor) {
                        const t = p.type;
                        if (t === PIECES.KRISHNA) break; // Blocks rays
                        const isOrtho = (dir[0] === 0 || dir[1] === 0);
                        if (isOrtho && (t === PIECES.ROOK || t === PIECES.QUEEN)) return true;
                        if (!isOrtho && (t === PIECES.BISHOP || t === PIECES.QUEEN)) return true;
                        if (i === 1 && t === PIECES.KING) return true;
                        if (i === 1 && !isOrtho && t === PIECES.PAWN) {
                            if (enemyColor === COLORS.WHITE && dir[0] === 1) return true; // White pawn attacks "down" (increasing r) ?
                            // Wait, White is at bottom (Rank 8). Moves up (Rank 7...).
                            // So White Pawn at r+1 attacks r? No.
                            // White Pawn at r+1 (Rank 7) moves to r (Rank 6).
                            // So White Pawn attacks `r-1` ?
                            // `forward = color === COLORS.WHITE ? -1 : 1` found in getLegalMoves.
                            // If White Pawn is at `tr`, checks `tr + forward`? No.
                            // We are at `r`. Enemy White Pawn is "below" us (higher rank index)?
                            // Yes. `dir[0] == 1` means checking `r+1`.
                            // If White is at `r+1`, it moves to `r`. So it attacks `r`.
                            if (enemyColor === COLORS.WHITE && dir[0] === 1) return true;
                            if (enemyColor === COLORS.BLACK && dir[0] === -1) return true;
                        }
                    }
                    break;
                }
            }
        }
        return false;
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
