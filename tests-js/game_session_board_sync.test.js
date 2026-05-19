import test from 'node:test';
import assert from 'node:assert/strict';

import { GameSession } from '../frontend/shared/game_session.js';
import { PGNManager } from '../frontend/pgn.js';
import { Rules } from '../frontend/rules.js';
import { MODES } from '../frontend/mode_logic.js';

test('executeAndRecordMove updates board and PGN move list together', () => {
    const pgn = new PGNManager();
    pgn.startNewGame('W', 'B', MODES.CVC);
    const session = new GameSession({
        pgnManager: pgn,
        getMode: () => MODES.CVC,
        getAiState: () => ({}),
        isAiTurnFn: () => false,
    });

    const from = { r: 7, c: 3 };
    const to = { r: 5, c: 3 };
    assert.ok(Rules.getLegalMoves(session.game.board, from.r, from.c).length > 0);
    session.executeAndRecordMove(from, to);

    assert.equal(session.game.board[from.r][from.c], null);
    assert.equal(session.game.board[to.r][to.c]?.type, 'p');
    assert.equal(pgn.currentGame.moves.length, 1);
    assert.equal(session.uciMoveHistory.length, 1);
});
