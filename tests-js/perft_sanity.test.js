import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { Rules } from '../frontend/rules.js';
import { assertGameInvariants } from './invariants/game_invariants.js';

function applyAndUndoAll(game, depth) {
    if (depth <= 0) return 1;
    const legal = Rules.getAllLegalMoves(game.board, game.turn);
    let nodes = 0;
    for (const m of legal) {
        const beforeHash = game.getHash();
        game.executeMove(m.from, m.to);
        assertGameInvariants(game, { label: `perft depth=${depth}` });
        nodes += applyAndUndoAll(game, depth - 1);
        const ok = game.undoLastMove();
        assert.equal(ok, true);
        assert.equal(game.getHash(), beforeHash);
    }
    return nodes;
}

test('sanity: depth-2 apply/undo over generated legal moves does not corrupt state', () => {
    const g = new Game();
    assertGameInvariants(g, { label: 'init' });
    const nodes = applyAndUndoAll(g, 2);
    assert.ok(nodes > 0);
    assertGameInvariants(g, { label: 'final' });
});

