import { BOARD_SIZE, COLORS, PIECES, WEIGHTS } from './constants.js';
import { Rules } from './rules.js';
import { GameBrain } from './brain.js';

// --- AI Strategy Base Class ---
class AIStrategy {
    constructor(name) {
        this.name = name;
    }

    evaluate(board, turn) {
        // Can be overridden by subclasses
        throw new Error('evaluate must be implemented by subclass');
    }

    evaluateWithRandomness(board, turn, addRandomness = false) {
        let score = this.evaluate(board, turn);

        // Add small random factor if enabled
        if (addRandomness) {
            const randomFactor = (Math.random() - 0.5) * 100; // ±50 points
            score += randomFactor;
        }

        return score;
    }

    getName() {
        return this.name;
    }
}

// --- Material Strategy (Current Implementation) ---
class MaterialStrategy extends AIStrategy {
    constructor() {
        super('Material');
    }

    evaluate(board, turn) {
        let score = 0;
        const centerBias = (r, c) => (r > 2 && r < 6 && c > 2 && c < 6) ? 15 : 0;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = board[r][c];
                if (!p) continue;

                let val = WEIGHTS[p.type] + centerBias(r, c);

                // Pawn advancement bonus (increased)
                if (p.type === PIECES.PAWN) {
                    val += (p.color === COLORS.WHITE ? (8 - r) * 8 : r * 8);
                }

                // Development bonus for knights and bishops
                if (p.type === PIECES.KNIGHT || p.type === PIECES.BISHOP) {
                    const homeRank = p.color === COLORS.WHITE ? 8 : 0;
                    if (r !== homeRank) val += 15; // Reward developed pieces
                }

                // King safety penalty if exposed
                if (p.type === PIECES.KING) {
                    const midRank = p.color === COLORS.WHITE ? (r < 6) : (r > 2);
                    if (midRank) val -= 30; // Penalty for king in center
                }

                if (p.color === COLORS.WHITE) score += val;
                else score -= val;
            }
        }

        // Add tempo bonus to encourage aggressive play
        const tempoBonus = turn === COLORS.WHITE ? 10 : -10;
        score += tempoBonus;

        return turn === COLORS.WHITE ? score : -score;
    }
}

// --- Positional Strategy ---
class PositionalStrategy extends AIStrategy {
    constructor() {
        super('Positional');

        // Piece-square tables for positional play
        this.pawnTable = this.createPawnTable();
        this.knightTable = this.createKnightTable();
        this.kingTable = this.createKingTable();
    }

    createPawnTable() {
        // Encourage pawn advancement and center control
        return [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5, 5],
            [5, 10, 10, -20, -20, 10, 10, 5, 5],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ];
    }

    createKnightTable() {
        // Knights better in center
        return [
            [-50, -40, -30, -30, -30, -30, -40, -50, -50],
            [-40, -20, 0, 0, 0, 0, -20, -40, -40],
            [-30, 0, 10, 15, 15, 10, 0, -30, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30, -30],
            [-30, 5, 10, 15, 15, 10, 5, -30, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50, -50],
            [-50, -40, -30, -30, -30, -30, -40, -50, -50]
        ];
    }

    createKingTable() {
        // King safety in early/mid game
        return [
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30, -30],
            [-20, -30, -30, -40, -40, -30, -30, -20, -20],
            [-10, -20, -20, -20, -20, -20, -20, -10, -10],
            [20, 20, 0, 0, 0, 0, 20, 20, 20],
            [20, 30, 10, 0, 0, 10, 30, 20, 20],
            [20, 40, 20, 0, 0, 20, 40, 20, 20]
        ];
    }

    evaluate(board, turn) {
        let score = 0;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = board[r][c];
                if (!p) continue;

                let val = WEIGHTS[p.type];

                // Add positional bonuses
                const row = p.color === COLORS.WHITE ? r : (8 - r);

                if (p.type === PIECES.PAWN) {
                    val += this.pawnTable[row][c];
                } else if (p.type === PIECES.KNIGHT) {
                    val += this.knightTable[row][c];
                } else if (p.type === PIECES.KING) {
                    val += this.kingTable[row][c];
                }

                // Mobility bonus
                const moves = Rules.getLegalMoves(board, r, c, false);
                val += moves.length * 2;

                if (p.color === COLORS.WHITE) score += val;
                else score -= val;
            }
        }

        return turn === COLORS.WHITE ? score : -score;
    }
}

// --- Aggressive Strategy (ULTRA AGGRESSIVE - Capture Everything!) ---
class AggressiveStrategy extends AIStrategy {
    constructor() {
        super('Aggressive');
    }

    evaluate(board, turn) {
        let score = 0;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = board[r][c];
                if (!p) continue;

                // Base material value (reduced importance)
                let val = WEIGHTS[p.type] * 0.5;  // Only 50% weight on material

                // MASSIVE bonus for pieces that can capture
                const moves = Rules.getLegalMoves(board, r, c, false);
                let captureBonus = 0;
                let bestCaptureValue = 0;

                moves.forEach(move => {
                    const target = board[move.r][move.c];
                    if (target && target.type !== PIECES.KRISHNA) {
                        // HUGE bonus for captures (except Krishna which can't be captured)
                        const captureValue = WEIGHTS[target.type];
                        captureBonus += captureValue * 2;  // 2x the piece value!
                        bestCaptureValue = Math.max(bestCaptureValue, captureValue);
                    }
                });

                // Extra bonus for the best capture available
                if (bestCaptureValue > 0) {
                    captureBonus += bestCaptureValue;  // Triple bonus for best capture!
                }

                val += captureBonus;

                // Huge mobility bonus (more moves = more capture chances)
                val += moves.length * 10;

                // Bonus for pieces near enemy pieces (hunting mode)
                let enemyProximity = 0;
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (Rules.isWithinBounds(nr, nc)) {
                            const neighbor = board[nr][nc];
                            if (neighbor && neighbor.color !== p.color && neighbor.type !== PIECES.KRISHNA) {
                                enemyProximity += WEIGHTS[neighbor.type] * 0.5;
                            }
                        }
                    }
                }
                val += enemyProximity;

                if (p.color === COLORS.WHITE) score += val;
                else score -= val;
            }
        }

        // Huge tempo bonus - always attack!
        const tempoBonus = turn === COLORS.WHITE ? 50 : -50;
        score += tempoBonus;

        return turn === COLORS.WHITE ? score : -score;
    }

    isWithinBounds(r, c) {
        return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    }
}

// --- AI Player ---
export class AIPlayer {
    constructor(level = 3, strategyName = 'material', brainName = 'default') {
        this.brain = new GameBrain(brainName);
        this.setLevel(level);
        this.setStrategy(strategyName);
        this.nodes = 0;
    }

    setLevel(l) {
        this.level = l;
        this.depth = l <= 2 ? 1 : (l <= 4 ? 2 : 3);
    }

    setStrategy(strategyName) {
        switch (strategyName.toLowerCase()) {
            case 'positional':
                this.strategy = new PositionalStrategy();
                break;
            case 'aggressive':
                this.strategy = new AggressiveStrategy();
                break;
            default:
                this.strategy = new MaterialStrategy();
        }
    }

    getStrategyName() {
        return this.strategy.getName();
    }

    evaluate(board, turn) {
        return this.strategy.evaluate(board, turn);
    }

    alphabeta(game, depth, alpha, beta, color, addRandomness = false) {
        if (depth === 0) {
            return this.strategy.evaluateWithRandomness(game.board, color, addRandomness);
        }

        const moves = Rules.getAllLegalMoves(game.board, color);
        if (moves.length === 0) {
            return this.strategy.evaluateWithRandomness(game.board, color, addRandomness);
        }

        // Yield control periodically (every 30ms)
        const now = performance.now();
        if (now - this.lastYieldTime > 30) {
            this.shouldYield = true;
        }

        let maxEval = -Infinity;
        for (const move of moves) {
            game.makeMove(move.from, move.to);
            const evalScore = -this.alphabeta(game, depth - 1, -beta, -alpha,
                color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE, addRandomness);
            game.undoMove();

            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }

        return maxEval;
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
        // Check randomness setting
        const randomnessCheckbox = document.getElementById('add-randomness');
        const addRandomness = randomnessCheckbox && randomnessCheckbox.checked;

        const moves = Rules.getAllLegalMoves(game.board, color);
        if (moves.length === 0) return null;

        // Check memory for bonuses
        const gameHash = game.getHash();
        const positionValue = this.brain.getPositionValue(gameHash);

        this.lastYieldTime = performance.now();
        this.shouldYield = false;

        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of moves) {
            if (this.shouldYield && !fastMode) {
                await new Promise(r => setTimeout(r, 0));
                this.lastYieldTime = performance.now();
                this.shouldYield = false;
            }

            game.makeMove(move.from, move.to);
            let score = -this.alphabeta(game, this.depth - 1, -Infinity, Infinity,
                color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE, addRandomness);
            game.undoMove();

            // Apply brain bonus
            const moveStr = `${move.from.r}${move.from.c}-${move.to.r}${move.to.c}`;
            const bonus = this.brain.getBonus(gameHash, moveStr);
            score += bonus * 0.5;

            // Add learned position value as a small prior (ML-ish).
            score += positionValue * 0.2;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        // Record move for learning
        if (bestMove) {
            const moveStr = `${bestMove.from.r}${bestMove.from.c}-${bestMove.to.r}${bestMove.to.c}`;
            this.brain.recordMove(gameHash, moveStr);
        }

        return bestMove;
    }
}
