import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { PIECES } from '../frontend/constants.js';
import { countNonKrishnaPieces, getPhase, PHASE } from '../frontend/shared/game_phase.js';

test('start position is opening', () => {
    const game = new Game();
    assert.equal(getPhase(game), PHASE.OPENING);
    assert.ok(countNonKrishnaPieces(game.board) >= 26);
});

test('sparse board is endgame', () => {
    const game = new Game();
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) game.board[r][c] = null;
    }
    game.board[4][4] = { type: PIECES.KING, color: 'w' };
    game.board[0][0] = { type: PIECES.KING, color: 'b' };
    game.board[1][1] = { type: PIECES.PAWN, color: 'w' };
    assert.equal(getPhase(game), PHASE.ENDGAME);
});
