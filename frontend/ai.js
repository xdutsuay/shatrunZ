import { BOARD_SIZE, COLORS, PIECES, WEIGHTS } from './constants.js';
import { Rules } from './rules.js';
import { GameBrain } from './brain.js';
import { levelToJsDepth } from './shared/persona.js';
import { getSettings } from './shared/settings_store.js';
import { openingBookBonus, endgameDepthBonus } from './shared/opening_book.js';
import { fetchPolicyBonuses, isPolicyNetEnabled } from './shared/policy_net.js';
import { moveToUCI } from './shared/uci.js';
import { evaluateForSearch } from './shared/eval_core.js';

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

// --- Persona strategies: thin wrappers over shared eval_core (HCE) ---
class MaterialStrategy extends AIStrategy {
    constructor() {
        super('Material');
        this.personaKey = 'material';
    }

    evaluate(board, turn) {
        return evaluateForSearch(board, turn, this.personaKey);
    }
}

class PositionalStrategy extends AIStrategy {
    constructor() {
        super('Positional');
        this.personaKey = 'positional';
    }

    evaluate(board, turn) {
        return evaluateForSearch(board, turn, this.personaKey);
    }
}

class AggressiveStrategy extends AIStrategy {
    constructor() {
        super('Aggressive');
        this.personaKey = 'aggressive';
    }

    evaluate(board, turn) {
        return evaluateForSearch(board, turn, this.personaKey);
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
        this.depth = levelToJsDepth(l);
    }

    setStrategy(strategyName) {
        const key = (strategyName || 'material').toLowerCase();
        this.strategyKey = key;
        switch (key) {
            case 'positional':
                this.strategy = new PositionalStrategy();
                break;
            case 'aggressive':
                this.strategy = new AggressiveStrategy();
                break;
            case 'c_native':
            case 'c_engine':
                this.strategy = new MaterialStrategy();
                break;
            default:
                this.strategy = new MaterialStrategy();
        }
    }

    getStrategyName() {
        if (this.strategyKey === 'c_native' || this.strategyKey === 'c_engine') {
            return 'C Native';
        }
        return this.strategy.getName();
    }

    getStrategyKey() {
        return this.strategyKey || 'material';
    }

    evaluate(board, turn) {
        return this.strategy.evaluate(board, turn);
    }

    quiescence(game, alpha, beta, color, addRandomness = false, qDepth = 4) {
        if (this.searchDeadline && performance.now() >= this.searchDeadline) {
            return this.strategy.evaluateWithRandomness(game.board, color, addRandomness);
        }
        let stand = this.strategy.evaluateWithRandomness(game.board, color, addRandomness);
        if (stand >= beta) return beta;
        if (alpha < stand) alpha = stand;
        if (qDepth <= 0) return alpha;

        const moves = Rules.getAllLegalMoves(game.board, color);
        for (const move of moves) {
            if (this.searchDeadline && performance.now() >= this.searchDeadline) break;
            const cap = game.board[move.to.r][move.to.c];
            if (!cap || cap.color === color) continue;
            game.makeMove(move.from, move.to);
            const score = -this.quiescence(game, -beta, -alpha,
                color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE, addRandomness, qDepth - 1);
            game.undoMove();
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    }

    alphabeta(game, depth, alpha, beta, color, addRandomness = false) {
        if (this.searchDeadline && performance.now() >= this.searchDeadline) {
            return this.strategy.evaluateWithRandomness(game.board, color, addRandomness);
        }
        if (depth === 0) {
            return this.quiescence(game, alpha, beta, color, addRandomness);
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

    async getBestMove(game, color, fastMode = false, opts = {}) {
        const addRandomness = getSettings().randomness;
        const budgetMs = opts.budgetMs || 0;
        const deadline = budgetMs > 0 ? performance.now() + budgetMs : 0;
        const onSearchUpdate = opts.onSearchUpdate;

        const moves = Rules.getAllLegalMoves(game.board, color);
        if (moves.length === 0) return null;

        const gameHash = game.getHash();
        const positionValue = this.brain.getPositionValue(gameHash);
        let maxDepth = this.depth + endgameDepthBonus(game);
        // Under a clock budget, cap the top of iterative deepening: the deadline is
        // primary, but a sane ceiling stops us from sinking the whole budget into a
        // deep iteration that gets cut and discarded (ID keeps the last full depth).
        if (budgetMs > 0) maxDepth = Math.min(maxDepth, 8);

        let policyBonuses = {};
        if (isPolicyNetEnabled() && budgetMs <= 0) {
            policyBonuses = await fetchPolicyBonuses(
                game, color, moves, opts.uciPrefix || []
            );
        }

        this.lastYieldTime = performance.now();
        this.shouldYield = false;
        this.searchDeadline = deadline;

        let bestMove = null;
        let bestScore = -Infinity;
        let secondScore = -Infinity;
        let lastCompletedDepth = 0;

        const yieldToUi = async () => {
            if (fastMode) return;
            await new Promise((r) => setTimeout(r, 0));
            this.lastYieldTime = performance.now();
            this.shouldYield = false;
        };

        const searchOneDepth = async (depth) => {
            let localBest = null;
            let localScore = -Infinity;
            let localSecond = -Infinity;

            for (const move of moves) {
                if (deadline && performance.now() >= deadline) break;
                const pieceBefore = game.board[move.from.r][move.from.c];
                if (this.shouldYield && !fastMode) {
                    await yieldToUi();
                }

                game.makeMove(move.from, move.to);
                let score = -this.alphabeta(game, depth - 1, -Infinity, Infinity,
                    color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE, addRandomness);
                game.undoMove();

                const moveStr = `${move.from.r}${move.from.c}-${move.to.r}${move.to.c}`;
                const uci = pieceBefore ? moveToUCI(move.from, move.to, pieceBefore) : null;
                score += this.brain.getBonus(gameHash, moveStr) * 0.5;
                score += openingBookBonus(this.brain, gameHash, moveStr, game);
                score += positionValue * 0.2;
                if (uci && policyBonuses[uci] != null) {
                    score += policyBonuses[uci] * 0.3;
                }

                if (score > localScore) {
                    localSecond = localScore;
                    localScore = score;
                    localBest = move;
                } else if (score > localSecond) {
                    localSecond = score;
                }
            }

            if (localBest) {
                bestMove = localBest;
                bestScore = localScore;
                secondScore = localSecond;
                lastCompletedDepth = depth;
                if (onSearchUpdate) {
                    const pb = game.board[localBest.from.r][localBest.from.c];
                    onSearchUpdate({
                        type: 'info',
                        depth,
                        cp: Math.round(localScore),
                        pv: pb ? [moveToUCI(localBest.from, localBest.to, pb)] : [],
                    });
                }
            }
            return localBest != null;
        };

        if (budgetMs > 0) {
            for (let d = 1; d <= maxDepth; d++) {
                if (performance.now() >= deadline) break;
                await searchOneDepth(d);
                if (performance.now() >= deadline) break;
            }
        } else {
            await searchOneDepth(maxDepth);
        }

        this.lastDecision = {
            bestScore,
            secondScore: secondScore === -Infinity ? bestScore : secondScore,
            move: bestMove,
            depthReached: bestMove ? lastCompletedDepth : 0,
        };

        if (bestMove) {
            const moveStr = `${bestMove.from.r}${bestMove.from.c}-${bestMove.to.r}${bestMove.to.c}`;
            this.brain.recordMove(gameHash, moveStr);
            if (onSearchUpdate) {
                const pb = game.board[bestMove.from.r][bestMove.from.c];
                onSearchUpdate({
                    type: 'info',
                    depth: lastCompletedDepth,
                    cp: Math.round(bestScore),
                    pv: pb ? [moveToUCI(bestMove.from, bestMove.to, pb)] : [],
                    final: true,
                });
            }
        }

        return bestMove;
    }
}
