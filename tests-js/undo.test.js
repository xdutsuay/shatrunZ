import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { GameBrain } from '../frontend/brain.js';
import { PGNManager } from '../frontend/pgn.js';
import { GameSession } from '../frontend/shared/game_session.js';
import { undoPlies, pvaiUndoPlies } from '../frontend/shared/undo_utils.js';
import { COLORS } from '../frontend/constants.js';

function mockStorage() {
    const store = new Map();
    return {
        getItem(k) { return store.has(k) ? store.get(k) : null; },
        setItem(k, v) { store.set(k, v); },
        removeItem(k) { store.delete(k); },
    };
}

test('PGNManager.popLastMove removes algebraic and UCI', () => {
    const pgn = new PGNManager();
    pgn.startNewGame('W', 'B', 'hvh');
    pgn.recordUciMove('e2e3');
    pgn.currentGame.moves.push('e3');
    assert.equal(pgn.currentGame.moves.length, 1);
    assert.equal(pgn.currentGame.uci_moves.length, 1);
    assert.ok(pgn.popLastMove());
    assert.equal(pgn.currentGame.moves.length, 0);
    assert.equal(pgn.currentGame.uci_moves.length, 0);
});

test('GameBrain.rollbackLastMove pops history trace', () => {
    const prev = global.localStorage;
    global.localStorage = mockStorage();
    try {
        const brain = new GameBrain('undo_test');
        brain.recordMove('hash1', '0-0');
        brain.recordMove('hash2', '1-1');
        assert.equal(brain.history.length, 2);
        assert.ok(brain.rollbackLastMove());
        assert.equal(brain.history.length, 1);
        assert.equal(brain.positionTrace.length, 1);
    } finally {
        global.localStorage = prev;
    }
});

test('GameSession.undoLastPly syncs board, UCI, PGN, brain', () => {
    const prev = global.localStorage;
    global.localStorage = mockStorage();
    try {
        const pgn = new PGNManager();
        pgn.startNewGame('W', 'B', 'hvh');
        const brain = new GameBrain('session_undo');
        const session = new GameSession({
            pgnManager: pgn,
            getMode: () => 'hvh',
            getAiState: () => ({}),
            isAiTurnFn: () => false,
        });
        const from = { r: 7, c: 4 };
        const to = { r: 6, c: 4 };
        session.executeAndRecordMove(from, to);
        brain.recordMove(session.game.getHash(), '7-4-6-4');
        assert.equal(session.uciMoveHistory.length, 1);
        assert.equal(pgn.currentGame.moves.length, 1);
        assert.ok(session.undoLastPly({ brain }));
        assert.equal(session.uciMoveHistory.length, 0);
        assert.equal(pgn.currentGame.moves.length, 0);
        assert.equal(brain.history.length, 0);
        assert.equal(session.game.moveHistory.length, 0);
    } finally {
        global.localStorage = prev;
    }
});

test('undoPlies removes N plies', () => {
    const pgn = new PGNManager();
    pgn.startNewGame('W', 'B', 'hvh');
    const session = new GameSession({
        pgnManager: pgn,
        getMode: () => 'hvh',
        getAiState: () => ({}),
        isAiTurnFn: () => false,
    });
    session.executeAndRecordMove({ r: 7, c: 4 }, { r: 6, c: 4 });
    session.executeAndRecordMove({ r: 1, c: 4 }, { r: 2, c: 4 });
    assert.equal(undoPlies(session, 2), 2);
    assert.equal(session.game.moveHistory.length, 0);
});

test('pvaiUndoPlies: AI turn undoes 1 ply, human turn undoes 2', () => {
    const pgn = new PGNManager();
    pgn.startNewGame('Human', 'AI', 'hvc');
    const session = new GameSession({
        pgnManager: pgn,
        getMode: () => 'hvc',
        getAiState: () => ({}),
        isAiTurnFn: () => false,
    });
    const game = session.game;
    game.executeMove({ r: 7, c: 4 }, { r: 6, c: 4 });
    session.uciMoveHistory.push('e2e3');
    pgn.recordUciMove('e2e3');
    pgn.currentGame.moves.push('e3');
    assert.equal(game.turn, COLORS.BLACK);
    assert.equal(pvaiUndoPlies(session, () => true, null), 1);
    assert.equal(game.moveHistory.length, 0);

    game.executeMove({ r: 7, c: 4 }, { r: 6, c: 4 });
    session.uciMoveHistory.push('e2e3');
    pgn.recordUciMove('e2e3');
    pgn.currentGame.moves.push('e3');
    game.executeMove({ r: 1, c: 4 }, { r: 2, c: 4 });
    session.uciMoveHistory.push('e7e6');
    pgn.recordUciMove('e7e6');
    pgn.currentGame.moves.push('e6');
    assert.equal(game.turn, COLORS.WHITE);
    assert.equal(pvaiUndoPlies(session, () => false, null), 2);
    assert.equal(game.moveHistory.length, 0);
});
