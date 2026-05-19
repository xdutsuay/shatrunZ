import { MODES, isAiTurn, shouldTriggerAiMove, shouldBlockHumanInput } from '../mode_logic.js';
import { ModeController } from './mode_controller.js';
import { getPvaiEngineMove } from '../shared/engine_move.js';
import { explainMove } from '../shared/move_explainer.js';
import { pvaiUndoPlies } from '../shared/undo_utils.js';
import { maybeAutoAskHelp } from '../shared/help_signal.js';

export class PvaiModeController extends ModeController {
    onEnter() {
        this.ctx.updateModePanels();
        this.ctx.rebuildPvaiPlayer();
        this.ctx.updateOpponentName();
    }

    computerSideValue() {
        return document.getElementById('computer-side')?.value || 'black';
    }

    isAiTurnNow() {
        return isAiTurn({ turn: this.ctx.game.turn, computerSideValue: this.computerSideValue() });
    }

    shouldBlockInput() {
        if (this.helpMode) return false;
        return shouldBlockHumanInput({
            mode: MODES.HVC,
            gameOver: this.ctx.game.gameOver,
            autoRunning: this.autoRunning,
            isTraining: this.ctx.isTraining,
            turn: this.ctx.game.turn,
            computerSideValue: this.computerSideValue(),
        });
    }

    onSquareClick(r, c) {
        const { game, Rules, session, boardView } = this.ctx;
        const { selectedSq, legalMoves } = this.ctx.getSelection();

        if (this.helpMode && this.isAiTurnNow()) {
            const move = legalMoves.find(m => m.r === r && m.c === c);
            if (move && selectedSq) {
                const hash = game.getHash();
                const moveStr = `${selectedSq.r}${selectedSq.c}-${move.r}${move.c}`;
                this.ctx.currentAI.brain.recordMove(hash, moveStr);
                session.executeAndRecordMove(selectedSq, move, {
                    isHelp: true,
                    helpReason: this.helpReason || 'manual',
                });
                this.ctx.clearSelection();
                boardView.render();
                this.ctx.refreshUi();
                const status = game.checkStatus();
                if (status.over) {
                    this.ctx.onGameEnd(status);
                } else {
                    this.resumeAfterHelp();
                }
            } else {
                const p = game.board[r][c];
                if (p && p.color === game.turn) {
                    this.ctx.setSelection({ r, c }, Rules.getLegalMoves(game.board, r, c));
                    boardView.render();
                } else {
                    this.ctx.clearSelection();
                    boardView.render();
                }
            }
            return true;
        }

        if (this.shouldBlockInput()) return true;

        const move = legalMoves.find(m => m.r === r && m.c === c);
        if (move && selectedSq) {
            session.executeAndRecordMove(selectedSq, move);
            this.ctx.clearSelection();
            boardView.render();
            this.ctx.refreshUi();

            if (!game.gameOver && shouldTriggerAiMove({
                mode: MODES.HVC,
                gameOver: game.gameOver,
                autoRunning: this.autoRunning,
                turn: game.turn,
                computerSideValue: this.computerSideValue(),
            })) {
                this.triggerAiMove();
            }
            return true;
        }

        const p = game.board[r][c];
        if (p && p.color === game.turn) {
            this.ctx.setSelection({ r, c }, Rules.getLegalMoves(game.board, r, c));
            boardView.render();
        } else {
            this.ctx.clearSelection();
            boardView.render();
        }
        return true;
    }

    onUndo() {
        const { session, boardView, currentAI } = this.ctx;
        if (this.ctx.isTraining) return;
        this.cancelPendingAiTimers();
        const undone = pvaiUndoPlies(session, () => this.isAiTurnNow(), currentAI.brain);
        if (undone > 0) {
            this.ctx.clearSelection();
            this.ctx.game.gameOver = false;
            boardView.render();
            this.ctx.refreshUi();
        }
    }

    onStartAuto() {
        if (this.isAiTurnNow() && !this.ctx.game.gameOver) {
            this.triggerAiMove();
        }
    }

    async triggerAiMove() {
        if (this.aiMoveInFlight) return;
        const { game, session, boardView, thinkEl, currentAI } = this.ctx;

        if (!shouldTriggerAiMove({
            mode: MODES.HVC,
            gameOver: game.gameOver,
            autoRunning: this.autoRunning,
            turn: game.turn,
            computerSideValue: this.computerSideValue(),
        })) {
            return;
        }

        this.aiMoveInFlight = true;
        const gen = this.bumpAiGeneration();
        thinkEl.innerText = 'Thinking...';
        await new Promise(r => setTimeout(r, 50));
        if (!this.isAiGenerationCurrent(gen) || !this.aiMoveInFlight) return;

        const useCEngine = document.getElementById('use-c-engine')?.checked ?? false;
        const moveStartTime = performance.now();
        let move = null;
        try {
            move = await getPvaiEngineMove({
                game,
                uciMoveHistory: session.uciMoveHistory,
                currentAI,
                useCEngine,
            });
        } catch (err) {
            console.error('PvAI move failed:', err);
        }

        thinkEl.innerText = '';
        this.aiMoveInFlight = false;

        if (!move) {
            this.stopAuto();
            this.ctx.statusEl.innerText = 'AI could not find a move — auto-play stopped.';
            return;
        }

        const decision = useCEngine ? null : currentAI.lastDecision;
        if (maybeAutoAskHelp(this, {
            game,
            brain: currentAI.brain,
            decision,
            prevEval: this._prevAiEval,
        })) {
            this.aiMoveInFlight = false;
            return;
        }

        const moveTimeSeconds = ((performance.now() - moveStartTime) / 1000).toFixed(2);
        this.ctx.updateMoveTime(game.turn, moveTimeSeconds);

        const record = session.executeAndRecordMove(move.from, move.to);
        boardView.render();
        this.ctx.refreshUi();
        this.ctx.maybeExplainMove(move, record, currentAI);

        if (!useCEngine && currentAI.lastDecision) {
            this._prevAiEval = currentAI.lastDecision.bestScore;
        }

        const status = game.checkStatus();
        if (status.over) {
            this.ctx.onGameEnd(status);
        }
    }
}
