import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, PIECES } from '../frontend/constants.js';
import { Game } from '../frontend/game.js';
import {
    evaluatePositionWhite,
    evaluateGameOverDisplay,
    evaluateForSearch,
} from '../frontend/shared/eval_core.js';

test('evaluatePositionWhite drops when Black captures White queen', () => {
    const g = new Game();
    const start = evaluatePositionWhite(g.board, 'material');
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const p = g.board[r][c];
            if (p?.type === PIECES.QUEEN && p.color === COLORS.WHITE) {
                g.board[r][c] = null;
            }
        }
    }
    const after = evaluatePositionWhite(g.board, 'material');
    assert.ok(after < start - 400, `start=${start} after=${after}`);
});

test('evaluateGameOverDisplay shows Black winning as negative', () => {
    assert.equal(evaluateGameOverDisplay(COLORS.BLACK), -10000);
    assert.equal(evaluateGameOverDisplay(COLORS.WHITE), 10000);
});

test('evaluateForSearch is negamax symmetric', () => {
    const g = new Game();
    const w = evaluateForSearch(g.board, COLORS.WHITE, 'positional');
    const b = evaluateForSearch(g.board, COLORS.BLACK, 'positional');
    assert.ok(Math.abs(w + b) < 50, `w=${w} b=${b} should oppose`);
});
