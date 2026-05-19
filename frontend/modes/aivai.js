import { COLORS } from '../constants.js';
import { MODES, shouldTriggerAiMove } from '../mode_logic.js';
import { ModeController } from './mode_controller.js';
import { getJsMoveForTurn } from '../shared/engine_move.js';
import { undoPlies } from '../shared/undo_utils.js';
import { maybeAutoAskHelp } from '../shared/help_signal.js';
export function pickAiForTurn(turn, ai1, ai2) {
    return turn === COLORS.WHITE ? ai1 : ai2;
}

export function shouldUseJsEngine() {
    return true;
}

export function strategyFromSelect(side) {
    const id = side === 'white' ? 'white-ai-strategy' : 'black-ai-strategy';
    return (document.getElementById(id)?.value || 'material').toLowerCase();
}

export class AivaiModeController extends ModeController {
    onEnter() {
        this.ctx.updateModePanels();
        this.ctx.rebuildAivaiPlayers();
        this.ctx.updateOpponentName();
    }

    shouldBlockInput() {
        const { game, isTraining } = this.ctx;
        if (game.gameOver || this.autoRunning || isTraining) return true;
        if (this.helpMode) return false;
        return true;
    }

    onSquareClick(r, c) {
        const { game, Rules, session, boardView } = this.ctx;
        const { selectedSq, legalMoves } = this.ctx.getSelection();

        if (this.helpMode) {
            const move = legalMoves.find(m => m.r === r && m.c === c);
            if (move && selectedSq) {
                const ai = pickAiForTurn(game.turn, this.ctx.ai1, this.ctx.ai2);
                const hash = game.getHash();
                const moveStr = `${selectedSq.r}${selectedSq.c}-${move.r}${move.c}`;
                ai.brain.recordMove(hash, moveStr);
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
        return false;
    }

    onUndo() {
        const { session, boardView } = this.ctx;
        if (this.ctx.isTraining) return;
        const wasAuto = this.autoRunning;
        this.cancelPendingAiTimers();
        if (undoPlies(session, 1)) {
            this.ctx.clearSelection();
            this.ctx.game.gameOver = false;
            boardView.render();
            this.ctx.refreshUi();
        }
        if (wasAuto) {
            this.autoRunning = true;
            this.ctx.syncAutoButtons();
        }
    }

    async triggerAiMove() {
        if (this.aiMoveInFlight) return;
        const { game, session, boardView, thinkEl } = this.ctx;

        if (!shouldTriggerAiMove({
            mode: MODES.CVC,
            gameOver: game.gameOver,
            autoRunning: this.autoRunning,
            turn: game.turn,
            computerSideValue: 'black',
        })) {
            return;
        }

        this.aiMoveInFlight = true;
        const gen = this.bumpAiGeneration();
        thinkEl.innerText = 'Thinking...';
        await new Promise(r => setTimeout(r, 50));
        if (!this.isAiGenerationCurrent(gen) || !this.aiMoveInFlight) return;

        const moveStartTime = performance.now();
        let move = null;
        try {
            move = await getJsMoveForTurn({
                game,
                ai1: this.ctx.ai1,
                ai2: this.ctx.ai2,
                turn: game.turn,
                uciMoveHistory: session.uciMoveHistory,
            });
        } catch (err) {
            console.error('AIvAI move failed:', err);
        }

        thinkEl.innerText = '';
        this.aiMoveInFlight = false;

        if (!move) {
            this.stopAuto();
            this.ctx.statusEl.innerText = 'AI could not find a move — auto-play stopped.';
            return;
        }

        const ai = pickAiForTurn(game.turn, this.ctx.ai1, this.ctx.ai2);
        if (maybeAutoAskHelp(this, {
            game,
            brain: ai.brain,
            decision: ai.lastDecision,
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
        this.ctx.maybeExplainMove(move, record, ai);
        if (ai.lastDecision) this._prevAiEval = ai.lastDecision.bestScore;

        const status = game.checkStatus();
        if (status.over) {
            this.ctx.onGameEnd(status);
        } else if (this.autoRunning) {
            this.scheduleAiChain(500, () => this.triggerAiMove());
        }
    }
}
