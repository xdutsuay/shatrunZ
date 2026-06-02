import test from 'node:test';
import assert from 'node:assert/strict';

import {
    brainNameFor,
    personaBrainName,
    depthForLevel,
    levelToJsDepth,
    hyperTrainPairings,
    legacyBrainNamesForPersona,
} from '../frontend/shared/persona.js';

test('brainNameFor returns strategy-based persona keys', () => {
    assert.equal(brainNameFor({ strategy: 'material' }), 'persona_material');
    assert.equal(brainNameFor({ strategy: 'positional' }), 'persona_positional');
    assert.equal(brainNameFor({ strategy: 'aggressive' }), 'persona_aggressive');
    assert.equal(brainNameFor({ personaId: 'c_native' }), 'persona_c_native');
});

test('personaBrainName maps c aliases to persona_c_native', () => {
    assert.equal(personaBrainName('c_native'), 'persona_c_native');
    assert.equal(personaBrainName('c_engine'), 'persona_c_native');
});

test('depthForLevel maps AI level 1–5 to search depth', () => {
    assert.equal(depthForLevel(1), 4);
    assert.equal(depthForLevel(5), 12);
    assert.equal(levelToJsDepth(3), 6);
});

test('hyperTrainPairings generates cross-strategy pairs', () => {
    const pairs = hyperTrainPairings(['material', 'positional']);
    assert.ok(pairs.some(([a, b]) => a === 'material' && b === 'positional'));
    assert.ok(pairs.some(([a, b]) => a === 'positional' && b === 'material'));
    assert.equal(pairs.filter(([a, b]) => a === b).length, 0);
});

test('legacyBrainNamesForPersona includes cvc and training keys', () => {
    const legacy = legacyBrainNamesForPersona('persona_material');
    assert.ok(legacy.includes('cvc_white_material'));
    assert.ok(legacy.includes('cvc_black_material'));
    assert.ok(legacy.includes('training_white_material'));
});
