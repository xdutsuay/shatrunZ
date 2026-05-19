import { Game } from '../game.js';
import { COLORS } from '../constants.js';
import { Rules } from '../rules.js';
import { MODES } from '../mode_logic.js';
import { moveToUCI } from './uci.js';
import { finalizeBrainsForResult, persistGameAndBrains } from './brain_utils.js';

export class GameSession {
    constructor({ pgnManager, getMode, getAiState, isAiTurnFn }) {
        this.pgnManager = pgnManager;
        this.getMode = getMode;
        this.getAiState = getAiState;
        this.isAiTurnFn = isAiTurnFn;
        this.game = new Game();
        this.uciMoveHistory = [];
    }

    reset() {
        this.game = new Game();
        this.uciMoveHistory = [];
    }

    abandonBrains() {
        const { ai1, ai2, currentAI } = this.getAiState();
        ai1.brain.abandonGame?.();
        ai2.brain.abandonGame?.();
        currentAI.brain.abandonGame?.();
    }

    /**
     * Undo one ply: board, UCI list, PGN, optional brain trace.
     * @param {{ brain?: import('../brain.js').GameBrain }} opts
     */
    undoLastPly(opts = {}) {
        if (!this.game.undoLastMove()) return false;
        if (this.uciMoveHistory.length > 0) this.uciMoveHistory.pop();
        this.pgnManager.popLastMove?.();
        if (opts.brain) opts.brain.rollbackLastMove();
        return true;
    }

    executeAndRecordMove(from, to, opts = {}) {
        const piece = this.game.board[from.r][from.c];
        const captured = this.game.board[to.r][to.c];
        const uci = moveToUCI(from, to, piece);
        const sideMoved = piece?.color || this.game.turn;
        const plyNum = this.uciMoveHistory.length + 1;

        this.game.executeMove(from, to);
        if (uci) {
            this.uciMoveHistory.push(uci);
            this.pgnManager.recordUciMove?.(uci);
        }

        if (opts.isHelp && uci) {
            this.pgnManager.recordHelpMove?.(
                plyNum,
                sideMoved,
                uci,
                opts.helpReason || ''
            );
        }

        const isCheck = Rules.isKingInCheck(this.game.board, this.game.turn);
        const status = this.game.checkStatus();
        const isCheckmate = status.over && isCheck;

        this.pgnManager.recordMove(from, to, piece, captured, isCheck, isCheckmate);
        return { piece, captured, isCheck, isCheckmate, status, uci };
    }

    async handleGameEnd(status, { onAfterEnd } = {}) {
        this.game.gameOver = true;
        const mode = this.getMode();
        const { ai1, ai2, currentAI } = this.getAiState();

        const pgnResult = finalizeBrainsForResult({
            mode,
            status,
            ai1,
            ai2,
            currentAI,
            isAiTurnFn: this.isAiTurnFn,
        });

        this.pgnManager.endGame(pgnResult, [...this.uciMoveHistory]);

        await persistGameAndBrains({
            pgnManager: this.pgnManager,
            uciMoveHistory: this.uciMoveHistory,
            pgnResult,
            ai1,
            ai2,
            currentAI,
            mode,
        });

        if (onAfterEnd) onAfterEnd(pgnResult);
        return pgnResult;
    }

    finalizeTrainingGame(status) {
        const { ai1, ai2 } = this.getAiState();
        finalizeBrainsForResult({
            mode: MODES.CVC,
            status,
            ai1,
            ai2,
            currentAI: ai1,
            isAiTurnFn: () => false,
        });
        const pgnResult = status.winner === COLORS.WHITE ? '1-0'
            : status.winner === COLORS.BLACK ? '0-1' : '1/2-1/2';
        this.pgnManager.endGame(pgnResult, [...this.uciMoveHistory]);
        this.game.gameOver = true;
    }
}
