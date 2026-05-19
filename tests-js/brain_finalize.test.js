import test from 'node:test';
import assert from 'node:assert/strict';

function mockLocalStorage() {
    const store = new Map();
    return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
}

import { GameBrain } from '../frontend/brain.js';
import { finalizeBrainsForResult } from '../frontend/shared/brain_utils.js';
import { MODES } from '../frontend/mode_logic.js';
import { COLORS } from '../frontend/constants.js';

test('finalizeGame increments stats.games', () => {
    global.localStorage = mockLocalStorage();
    const brain = new GameBrain('test_finalize');
    brain.clear();
    brain.recordMove('hash1', '0,0-1,1');
    brain.finalizeGame('win');
    assert.equal(brain.getStats().games, 1);
    assert.equal(brain.getStats().wins, 1);
});

test('abandonGame clears in-progress history without counting game', () => {
    global.localStorage = mockLocalStorage();
    const brain = new GameBrain('test_abandon');
    brain.clear();
    brain.recordMove('hash1', '0,0-1,1');
    brain.abandonGame();
    brain.finalizeGame('win');
    assert.equal(brain.getStats().games, 0);
});

test('finalizeBrainsForResult updates both AIvAI brains', () => {
    global.localStorage = mockLocalStorage();
    const ai1 = { brain: new GameBrain('t1') };
    const ai2 = { brain: new GameBrain('t2') };
    ai1.brain.clear();
    ai2.brain.clear();
    ai1.brain.recordMove('h', 'm1');
    ai2.brain.recordMove('h2', 'm2');

    const result = finalizeBrainsForResult({
        mode: MODES.CVC,
        status: { winner: COLORS.WHITE },
        ai1,
        ai2,
        currentAI: ai1,
        isAiTurnFn: () => false,
    });

    assert.equal(result, '1-0');
    assert.equal(ai1.brain.getStats().games, 1);
    assert.equal(ai2.brain.getStats().games, 1);
});
