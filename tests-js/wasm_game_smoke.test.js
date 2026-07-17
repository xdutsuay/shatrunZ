/**
 * P6 smoke: WasmGame facade via frontend Game adapter.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../frontend/game.js';
import { COLORS } from '../frontend/constants.js';
import { Rules } from '../frontend/rules.js';

describe('wasm Game facade', () => {
    it('starts with white to move and 22 legal moves', () => {
        const g = new Game();
        assert.equal(g.turn, COLORS.WHITE);
        assert.equal(g.getHash().startsWith('w|'), true);
        const moves = Rules.getAllLegalMoves(g.board, g.turn);
        assert.equal(moves.length, 22);
    });

    it('executeMove e2e4 flips turn and updates hash', () => {
        const g = new Game();
        const before = g.getHash();
        const ok = g.executeMove({ r: 7, c: 4 }, { r: 5, c: 4 });
        assert.equal(ok, true);
        assert.equal(g.turn, COLORS.BLACK);
        assert.notEqual(g.getHash(), before);
        assert.equal(g.board[5][4]?.type, 'p');
        assert.equal(g.board[7][4], null);
    });

    it('undoLastMove restores startpos', () => {
        const g = new Game();
        const start = g.getHash();
        g.executeMove({ r: 7, c: 4 }, { r: 5, c: 4 });
        assert.equal(g.undoLastMove(), true);
        assert.equal(g.turn, COLORS.WHITE);
        assert.equal(g.getHash(), start);
    });
});
