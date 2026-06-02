import { BOARD_SIZE, COLORS, PIECES, WEIGHTS } from './constants.js';
import { Rules } from './rules.js';

export class Game {
    constructor() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.turn = COLORS.WHITE;
        this.gameOver = false;
        this.moveHistory = []; // Stack for Undo
        this.positionHistory = {}; // For Threefold Repetition
        this._aiStack = []; // Internal stack for AI search (does not affect UI undo)
        this.initBoard();
    }

    initBoard() {
        // Swapped Krishna and Bishop at index 5 and 6 to ensure bishops are on opposite colors
        const back = [PIECES.ROOK, PIECES.KNIGHT, PIECES.BISHOP, PIECES.QUEEN, PIECES.KING, PIECES.BISHOP, PIECES.KRISHNA, PIECES.KNIGHT, PIECES.ROOK];
        back.forEach((t, c) => this.board[0][c] = { type: t, color: COLORS.BLACK });
        for (let c = 0; c < BOARD_SIZE; c++) this.board[1][c] = { type: PIECES.PAWN, color: COLORS.BLACK };
        for (let c = 0; c < BOARD_SIZE; c++) this.board[7][c] = { type: PIECES.PAWN, color: COLORS.WHITE };
        back.forEach((t, c) => this.board[8][c] = { type: t, color: COLORS.WHITE });
    }

    // Hash for Repetition
    getHash() {
        let str = this.turn + "|";
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (p) str += `${p.color}${p.type}${r}${c}`;
            }
        }
        return str;
    }

    executeMove(from, to) {
        const p = this.board[from.r][from.c];
        if (!p) return false;
        if (p.color !== this.turn) {
            console.warn('executeMove rejected: piece color', p.color, '!= turn', this.turn);
            return false;
        }
        const captured = this.board[to.r][to.c];

        // 1. Record History for Undo
        this.moveHistory.push({
            from: { ...from },
            to: { ...to },
            movedPiece: { ...p }, // Copy piece state
            capturedPiece: captured ? { ...captured } : null,
            prevTurn: this.turn,
            hash: this.getHash() // Save hash to revert repetition count
        });

        // 2. Execute Data Move
        // We create a new object for the destination to ensure clean state
        this.board[to.r][to.c] = p;
        this.board[from.r][from.c] = null;

        // 3. Handle Promotion
        if (p.type === PIECES.PAWN && (to.r === 0 || to.r === 8)) {
            p.type = PIECES.QUEEN; // Mutates p, which is now at board[to]
            // We stored the *original* p type in moveHistory, so undo will work
        }

        // 4. Handle Castling (Rook Move)
        if (to.isCastling) {
            const rank = from.r;
            const isKingside = to.c > from.c;
            const rookFromCol = isKingside ? 8 : 0;
            const rookToCol = isKingside ? 5 : 3;

            const rook = this.board[rank][rookFromCol];
            // Safety check
            if (rook) {
                this.board[rank][rookToCol] = rook;
                this.board[rank][rookFromCol] = null;

                // Add to history
                this.moveHistory[this.moveHistory.length - 1].castlingRook = {
                    from: { r: rank, c: rookFromCol },
                    to: { r: rank, c: rookToCol },
                    piece: rook
                };
            }
        }

        // 5. Update Game State
        this.turn = this.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // Update Repetition
        const newHash = this.getHash();
        this.positionHistory[newHash] = (this.positionHistory[newHash] || 0) + 1;
        return true;
    }

    /**
     * Lightweight move application for AI search.
     * - Does NOT touch moveHistory / repetition tracking
     * - Does NOT toggle this.turn (AI search passes color explicitly)
     */
    makeMove(from, to) {
        const moved = this.board[from.r][from.c];
        if (!moved) return false;

        const captured = this.board[to.r][to.c];

        const undoRec = {
            from: { ...from },
            to: { r: to.r, c: to.c },
            movedPiece: moved,
            capturedPiece: captured,
            promotedFrom: null,
            castlingRook: null
        };

        // Move piece
        this.board[to.r][to.c] = moved;
        this.board[from.r][from.c] = null;

        // Promotion (JS rules auto-promote to queen)
        if (moved.type === PIECES.PAWN && (to.r === 0 || to.r === 8)) {
            undoRec.promotedFrom = PIECES.PAWN;
            moved.type = PIECES.QUEEN;
        }

        // Castling (if provided by Rules.getLegalMoves)
        if (to.isCastling) {
            const rank = from.r;
            const isKingside = to.c > from.c;
            const rookFromCol = isKingside ? 8 : 0;
            const rookToCol = isKingside ? 5 : 3;
            const rook = this.board[rank][rookFromCol];
            if (rook) {
                this.board[rank][rookToCol] = rook;
                this.board[rank][rookFromCol] = null;
                undoRec.castlingRook = {
                    from: { r: rank, c: rookFromCol },
                    to: { r: rank, c: rookToCol },
                    piece: rook
                };
            }
        }

        this._aiStack.push(undoRec);
        return true;
    }

    undoMove() {
        const rec = this._aiStack.pop();
        if (!rec) return false;

        // Undo castling rook first (so destination squares free)
        if (rec.castlingRook) {
            const { from, to, piece } = rec.castlingRook;
            this.board[from.r][from.c] = piece;
            this.board[to.r][to.c] = null;
        }

        // Move piece back
        const moved = this.board[rec.to.r][rec.to.c];
        this.board[rec.from.r][rec.from.c] = moved;
        this.board[rec.to.r][rec.to.c] = rec.capturedPiece;

        // Undo promotion
        if (moved && rec.promotedFrom) {
            moved.type = rec.promotedFrom;
        }

        return true;
    }

    undoLastMove() {
        if (this.moveHistory.length === 0) return false;

        const lastMove = this.moveHistory.pop();

        // 1. Revert Repetition Count (of the state we are leaving)
        const currentHash = this.getHash();
        if (this.positionHistory[currentHash]) this.positionHistory[currentHash]--;

        // 2. Restore Board
        this.board[lastMove.from.r][lastMove.from.c] = lastMove.movedPiece;
        this.board[lastMove.to.r][lastMove.to.c] = lastMove.capturedPiece;

        // 3. Restore Castling Rook
        if (lastMove.castlingRook) {
            const { from, to, piece } = lastMove.castlingRook;
            this.board[from.r][from.c] = piece;
            this.board[to.r][to.c] = null;
        }

        // 4. Restore Turn & State
        this.turn = lastMove.prevTurn;
        this.gameOver = false; // If we undo a checkmate, game is on again

        return true;
    }

    checkStatus() {
        // Returns status object: { over: bool, msg: string, winner: 'w'/'b'/null }
        const inCheck = Rules.isKingInCheck(this.board, this.turn);
        const hasMoves = this.hasLegalMoves(this.turn);

        // Repetition Check (relaxed to 5 to reduce draws)
        const h = this.getHash();
        if (this.positionHistory[h] >= 5) {
            return { over: true, msg: "Draw by Repetition", winner: null };
        }

        // Adjudication (reduce endless games): if a game runs very long, decide by material.
        // This is intentionally simple and only triggers after lots of moves.
        if (this.moveHistory.length >= 240) {
            const score = this.getScore(); // white - black centipawns-ish
            if (Math.abs(score) >= 300) {
                const winner = score > 0 ? COLORS.WHITE : COLORS.BLACK;
                return { over: true, msg: `Adjudicated: ${winner === COLORS.WHITE ? "White" : "Black"} wins (material)`, winner };
            }
        }

        if (!hasMoves) {
            if (inCheck) {
                const winner = this.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
                return { over: true, msg: `CHECKMATE! ${winner === COLORS.WHITE ? "White" : "Black"} Wins`, winner: winner };
            } else {
                return { over: true, msg: "Stalemate", winner: null };
            }
        }

        let msg = this.turn === COLORS.WHITE ? "White's Turn" : "Black's Turn";
        if (inCheck) msg += " (CHECK)";
        return { over: false, msg: msg, winner: null };
    }

    hasLegalMoves(color) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (this.board[r][c] && this.board[r][c].color === color) {
                    if (Rules.getLegalMoves(this.board, r, c, true).length > 0) return true;
                }
            }
        }
        return false;
    }

    getScore() {
        let w = 0, b = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (p) {
                    if (p.color === COLORS.WHITE) w += WEIGHTS[p.type];
                    else b += WEIGHTS[p.type];
                }
            }
        }
        return w - b;
    }
}
