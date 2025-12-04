import { BOARD_SIZE, COLORS, PIECES, WEIGHTS } from './constants.js';
import { Rules } from './rules.js';

// --- AI Brain (Memory) ---
export class GameBrain {
    constructor() {
        this.memoryKey = 'shatrunz_brain_v2';
        this.memory = this.loadMemory();
        this.history = [];
    }

    loadMemory() {
        try { return JSON.parse(localStorage.getItem(this.memoryKey)) || {}; }
        catch (e) { return {}; }
    }

    saveMemory() {
        try { localStorage.setItem(this.memoryKey, JSON.stringify(this.memory)); } catch (e) { }
    }

    clear() { this.memory = {}; localStorage.removeItem(this.memoryKey); }

    recordMove(hash, moveStr) { this.history.push({ hash, move: moveStr }); }

    finalizeGame(result) { // 'win', 'loss', 'draw'
        if (this.history.length === 0) return;
        const reward = result === 'win' ? 10 : (result === 'loss' ? -10 : -2);
        let decay = 10; // Simple decaying reward for last 10 moves

        for (let i = this.history.length - 1; i >= 0 && decay > 0; i--) {
            const { hash, move } = this.history[i];
            if (!this.memory[hash]) this.memory[hash] = {};
            if (!this.memory[hash][move]) this.memory[hash][move] = 0;
            this.memory[hash][move] += reward;
            decay--;
        }
        this.saveMemory();
        this.history = [];
    }

    getBonus(hash, moveStr) {
        if (this.memory[hash] && this.memory[hash][moveStr]) return this.memory[hash][moveStr] * 0.5;
        return 0;
    }
}

// --- AI Player ---
export class AIPlayer {
    constructor(level = 3) {
        this.brain = new GameBrain();
        this.setLevel(level);
        this.nodes = 0;
    }

    setLevel(l) {
        this.level = l;
        this.depth = l <= 2 ? 1 : (l <= 4 ? 2 : 3);
    }

    evaluate(board, turn) {
        let score = 0;
        // Simple Piece-Square Table bias for center
        const centerBias = (r, c) => (r > 2 && r < 6 && c > 2 && c < 6) ? 10 : 0;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = board[r][c];
                if (!p) continue;
                let val = WEIGHTS[p.type] + centerBias(r, c);
                if (p.type === PIECES.PAWN) val += (p.color === COLORS.WHITE ? (8 - r) * 5 : r * 5);

                if (p.color === COLORS.WHITE) score += val;
                else score -= val;
            }
        }
        return turn === COLORS.WHITE ? score : -score;
    }

    minimax(board, depth, alpha, beta, isMaximizing, turn) {
        this.nodes++;
        if (depth === 0) return this.evaluate(board, turn);

        const moves = this.generateMoves(board, turn);
        if (moves.length === 0) {
            if (Rules.isKingInCheck(board, turn)) return -100000 + depth;
            return 0;
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const m of moves) {
                const undo = this.applyMove(board, m);
                const evalVal = this.minimax(board, depth - 1, alpha, beta, false, turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
                this.undoMove(board, m, undo);
                maxEval = Math.max(maxEval, evalVal);
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const m of moves) {
                const undo = this.applyMove(board, m);
                const evalVal = this.minimax(board, depth - 1, alpha, beta, true, turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
                this.undoMove(board, m, undo);
                minEval = Math.min(minEval, evalVal);
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    generateMoves(board, color) {
        let moves = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] && board[r][c].color === color) {
                    const legals = Rules.getLegalMoves(board, r, c, true);
                    legals.forEach(to => moves.push({ from: { r, c }, to: to }));
                }
            }
        }
        // Capture sort optimization
        moves.sort((a, b) => (board[b.to.r][b.to.c] ? 10 : 0) - (board[a.to.r][a.to.c] ? 10 : 0));
        return moves;
    }

    applyMove(board, move) {
        const p = board[move.from.r][move.from.c];
        const captured = board[move.to.r][move.to.c];
        board[move.to.r][move.to.c] = p;
        board[move.from.r][move.from.c] = null;
        let promoted = false;
        if (p.type === PIECES.PAWN && (move.to.r === 0 || move.to.r === 8)) {
            p.type = PIECES.QUEEN;
            promoted = true;
        }
        return { captured, promoted };
    }

    undoMove(board, move, undoInfo) {
        const p = board[move.to.r][move.to.c];
        if (undoInfo.promoted) p.type = PIECES.PAWN;
        board[move.from.r][move.from.c] = p;
        board[move.to.r][move.to.c] = undoInfo.captured;
    }

    async getBestMove(game, color, fastMode = false) {
        this.nodes = 0;
        // Deep copy board for AI to mess with
        const boardCopy = game.board.map(row => row.map(cell => cell ? { ...cell } : null));
        const moves = this.generateMoves(boardCopy, color);
        if (moves.length === 0) return null;

        let bestMove = null;
        let bestVal = -Infinity;

        // Hash helper
        const hash = game.getHash();

        let lastYieldTime = performance.now();

        for (const m of moves) {
            const undo = this.applyMove(boardCopy, m);
            let val = this.minimax(boardCopy, this.depth - 1, -Infinity, Infinity, false, color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);

            // Brain Bonus
            const moveStr = `${m.from.r}${m.from.c}-${m.to.r}${m.to.c}`;
            val += this.brain.getBonus(hash, moveStr);

            this.undoMove(boardCopy, m, undo);

            if (val > bestVal) { bestVal = val; bestMove = m; }

            // Yield to main thread every 30ms to keep UI responsive
            if (performance.now() - lastYieldTime > 30) {
                await new Promise(r => setTimeout(r, 0));
                lastYieldTime = performance.now();
            }
        }

        if (bestMove) {
            const moveStr = `${bestMove.from.r}${bestMove.from.c}-${bestMove.to.r}${bestMove.to.c}`;
            this.brain.recordMove(hash, moveStr);
        }
        return bestMove;
    }
}
