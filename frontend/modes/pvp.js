import { MODES, shouldBlockHumanInput } from '../mode_logic.js';
import { ModeController } from './mode_controller.js';

export class PvpModeController extends ModeController {
    onEnter() {
        this.ctx.updateModePanels();
        this.ctx.updateOpponentName();
    }

    shouldBlockInput() {
        return shouldBlockHumanInput({
            mode: MODES.HVH,
            gameOver: this.ctx.game.gameOver,
            autoRunning: false,
            isTraining: this.ctx.isTraining,
            turn: this.ctx.game.turn,
            computerSideValue: 'black',
        });
    }

    onSquareClick(r, c) {
        const { game, Rules, session, boardView } = this.ctx;
        const { selectedSq, legalMoves } = this.ctx.getSelection();

        if (this.shouldBlockInput()) return true;

        const move = legalMoves.find(m => m.r === r && m.c === c);
        if (move && selectedSq) {
            session.executeAndRecordMove(selectedSq, move);
            this.ctx.clearSelection();
            boardView.render();
            this.ctx.refreshUi();
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
        const { session, boardView } = this.ctx;
        if (this.ctx.isTraining) return;
        if (session.undoLastPly()) {
            this.ctx.clearSelection();
            this.ctx.game.gameOver = false;
            boardView.render();
            this.ctx.refreshUi();
        }
    }
}
