import test from 'node:test';
import assert from 'node:assert/strict';

import {
    evaluateNeedsHelp,
    formatHelpStatus,
    sideLabel,
    DEFAULT_HELP_THRESHOLDS,
} from '../frontend/shared/help_signal.js';
import { COLORS } from '../frontend/constants.js';

function baseSettings(over = {}) {
    return {
        enableHelp: true,
        autoAsk: true,
        evalSwing: true,
        lowMargin: true,
        unknown: true,
        repeat: true,
        ...over,
    };
}

test('evaluateNeedsHelp: low margin triggers', () => {
    const { ask, reason } = evaluateNeedsHelp({
        game: { getHash: () => 'h', positionHistory: {} },
        brain: { memory: { h: { '0-0': 5 } } },
        decision: { bestScore: 100, secondScore: 95 },
        prevEval: null,
        thresholds: DEFAULT_HELP_THRESHOLDS,
        settings: baseSettings(),
    });
    assert.ok(ask);
    assert.match(reason, /low margin/i);
});

test('evaluateNeedsHelp: unknown position triggers', () => {
    const { ask, reason } = evaluateNeedsHelp({
        game: { getHash: () => 'new', positionHistory: {} },
        brain: { memory: {} },
        decision: { bestScore: 50, secondScore: 40 },
        prevEval: null,
        thresholds: DEFAULT_HELP_THRESHOLDS,
        settings: baseSettings(),
    });
    assert.ok(ask);
    assert.match(reason, /unknown/i);
});

test('evaluateNeedsHelp: eval swing triggers', () => {
    const { ask } = evaluateNeedsHelp({
        game: { getHash: () => 'h', positionHistory: {} },
        brain: { memory: { h: { m: 10 } } },
        decision: { bestScore: 0, secondScore: -50 },
        prevEval: 400,
        thresholds: DEFAULT_HELP_THRESHOLDS,
        settings: baseSettings(),
    });
    assert.ok(ask);
});

test('evaluateNeedsHelp: repetition triggers', () => {
    const { ask, reason } = evaluateNeedsHelp({
        game: { getHash: () => 'h', positionHistory: { h: 3 } },
        brain: { memory: { h: { m: 10 } } },
        decision: { bestScore: 100, secondScore: 50 },
        prevEval: 100,
        thresholds: DEFAULT_HELP_THRESHOLDS,
        settings: baseSettings(),
    });
    assert.ok(ask);
    assert.match(reason, /repetition/i);
});

test('formatHelpStatus: side name is primary, reason is secondary', () => {
    const { primary, secondary, full } = formatHelpStatus(COLORS.BLACK, 'eval swing (319 cp)');
    assert.equal(primary, 'Black is asking for help');
    assert.match(secondary, /eval swing/);
    assert.match(full, /^Black is asking for help/);
    assert.ok(!primary.includes('eval swing'));
});

test('sideLabel maps colors', () => {
    assert.equal(sideLabel(COLORS.WHITE), 'White');
    assert.equal(sideLabel(COLORS.BLACK), 'Black');
});

test('evaluateNeedsHelp: disabled when autoAsk off', () => {
    const { ask } = evaluateNeedsHelp({
        game: { getHash: () => 'h', positionHistory: { h: 5 } },
        brain: { memory: {} },
        decision: null,
        prevEval: null,
        thresholds: DEFAULT_HELP_THRESHOLDS,
        settings: baseSettings({ autoAsk: false }),
    });
    assert.equal(ask, false);
});
