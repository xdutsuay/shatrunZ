import { Game } from '../game.js';
import { parseUCIMove } from './uci.js';

/** Step-through replay over a fixed UCI move list. */
export class ReplayStepController {
    constructor(uciMoves) {
        this.uciMoves = [...uciMoves];
        this.ply = 0;
        this.game = new Game();
        this._rebuild();
    }

    _rebuild() {
        this.game = new Game();
        for (let i = 0; i < this.ply; i++) {
            const parsed = parseUCIMove(this.uciMoves[i]);
            if (!parsed) throw new Error(`Invalid UCI: ${this.uciMoves[i]}`);
            this.game.executeMove(parsed.from, parsed.to);
        }
    }

    get maxPly() {
        return this.uciMoves.length;
    }

    stepTo(ply) {
        const target = Math.max(0, Math.min(ply, this.maxPly));
        this.ply = target;
        this._rebuild();
        return this.ply;
    }

    stepForward() {
        if (this.ply >= this.maxPly) return this.ply;
        return this.stepTo(this.ply + 1);
    }

    stepBack() {
        if (this.ply <= 0) return this.ply;
        return this.stepTo(this.ply - 1);
    }

    get uciHistory() {
        return this.uciMoves.slice(0, this.ply);
    }
}
