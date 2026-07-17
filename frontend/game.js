/**
 * Game facade over WasmGame (shatrunz-core). Keeps a JS 9×9 `board` mirror
 * for ui.js / Rules callers. Call `await initWasm()` before `new Game()`.
 */

import { BOARD_SIZE, COLORS, PIECES } from './constants.js';
import { Rules } from './rules.js';
import { getWasm } from './shared/wasm_boot.js';

function emptyBoard() {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}

function normalizePiece(p) {
    if (!p) return null;
    return { type: p.type, color: p.color };
}

export class Game {
    constructor() {
        const { WasmGame } = getWasm();
        this._wasm = new WasmGame();
        this.board = emptyBoard();
        this.turn = COLORS.WHITE;
        this.gameOver = false;
        this.moveHistory = [];
        this.positionHistory = {};
        this._aiStack = [];
        this._syncFromWasm();
    }

    /** Refresh `board` / `turn` / `gameOver` from wasm. */
    _syncFromWasm() {
        const raw = this._wasm.board();
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                this.board[r][c] = normalizePiece(raw[r][c]);
            }
        }
        this.turn = this._wasm.turn();
        const st = this._wasm.checkStatus();
        this.gameOver = !!st.over;
    }

    getHash() {
        return this._wasm.positionKey();
    }

    executeMove(from, to) {
        const p = this.board[from.r]?.[from.c];
        if (!p) return false;
        if (p.color !== this.turn) {
            console.warn('executeMove rejected: piece color', p.color, '!= turn', this.turn);
            return false;
        }
        const captured = this.board[to.r]?.[to.c]
            ? { ...this.board[to.r][to.c] }
            : null;
        const prevTurn = this.turn;
        const hashBefore = this.getHash();

        const target = {
            r: to.r,
            c: to.c,
            isCastling: !!to.isCastling,
            side: to.side || (to.isCastling ? (to.c > from.c ? 'k' : 'q') : undefined),
        };

        const ok = this._wasm.executeMove(from.r, from.c, target);
        if (!ok) return false;

        this.moveHistory.push({
            from: { ...from },
            to: { ...to },
            movedPiece: { ...p },
            capturedPiece: captured,
            prevTurn,
            hash: hashBefore,
        });

        this._syncFromWasm();
        const newHash = this.getHash();
        this.positionHistory[newHash] = (this.positionHistory[newHash] || 0) + 1;
        return true;
    }

    /**
     * Lightweight AI make/unmake on the JS mirror only (wasm search uses its
     * own stack via searchBestMove).
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
            castlingRook: null,
        };
        this.board[to.r][to.c] = moved;
        this.board[from.r][from.c] = null;
        if (moved.type === PIECES.PAWN && (to.r === 0 || to.r === 8)) {
            undoRec.promotedFrom = PIECES.PAWN;
            moved.type = PIECES.QUEEN;
        }
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
                    piece: rook,
                };
            }
        }
        this._aiStack.push(undoRec);
        return true;
    }

    undoMove() {
        const rec = this._aiStack.pop();
        if (!rec) return false;
        if (rec.castlingRook) {
            const { from, to, piece } = rec.castlingRook;
            this.board[from.r][from.c] = piece;
            this.board[to.r][to.c] = null;
        }
        const moved = this.board[rec.to.r][rec.to.c];
        this.board[rec.from.r][rec.from.c] = moved;
        this.board[rec.to.r][rec.to.c] = rec.capturedPiece;
        if (moved && rec.promotedFrom) moved.type = rec.promotedFrom;
        return true;
    }

    undoLastMove() {
        if (this.moveHistory.length === 0) return false;
        const lastMove = this.moveHistory.pop();
        const currentHash = this.getHash();
        if (this.positionHistory[currentHash]) this.positionHistory[currentHash]--;

        const ok = this._wasm.undoLastMove();
        if (!ok) {
            this.moveHistory.push(lastMove);
            return false;
        }
        this._syncFromWasm();
        this.gameOver = false;
        return true;
    }

    checkStatus() {
        const st = this._wasm.checkStatus();
        return {
            over: !!st.over,
            msg: st.msg,
            winner: st.winner ?? null,
        };
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
        return this._wasm.getScore();
    }
}
