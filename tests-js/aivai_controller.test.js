import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORS } from '../frontend/constants.js';
import { pickAiForTurn, shouldUseJsEngine, strategyFromSelect } from '../frontend/modes/aivai.js';

test('pickAiForTurn maps white to ai1 and black to ai2', () => {
    const ai1 = { id: 'white' };
    const ai2 = { id: 'black' };
    assert.equal(pickAiForTurn(COLORS.WHITE, ai1, ai2), ai1);
    assert.equal(pickAiForTurn(COLORS.BLACK, ai1, ai2), ai2);
});

test('shouldUseJsEngine is always true for AIvAI', () => {
    assert.equal(shouldUseJsEngine(), true);
});

test('strategyFromSelect reads DOM when elements exist', () => {
    const doc = {
        getElementById(id) {
            if (id === 'white-ai-strategy') return { value: 'aggressive' };
            if (id === 'black-ai-strategy') return { value: 'positional' };
            return null;
        },
    };
    const prev = global.document;
    global.document = doc;
    try {
        assert.equal(strategyFromSelect('white'), 'aggressive');
        assert.equal(strategyFromSelect('black'), 'positional');
    } finally {
        global.document = prev;
    }
});
