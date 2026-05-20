import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORS } from '../frontend/constants.js';
import { ClockController, formatClock } from '../frontend/shared/clock_controller.js';

test('formatClock formats mm:ss with zero padding', () => {
    assert.equal(formatClock(0), '0:00');
    assert.equal(formatClock(999), '0:00');
    assert.equal(formatClock(1000), '0:01');
    assert.equal(formatClock(61_000), '1:01');
});

test('ClockController applies increment after move', () => {
    const c = new ClockController({ totalMs: 10_000, incrementMs: 2_000 });
    c.reset({ totalMs: 10_000, incrementMs: 2_000, turn: COLORS.WHITE });

    assert.equal(c.whiteMs, 10_000);
    assert.equal(c.blackMs, 10_000);

    c.onMoveMade(COLORS.WHITE, COLORS.BLACK);
    assert.equal(c.whiteMs, 12_000);
    assert.equal(c.blackMs, 10_000);

    c.onMoveMade(COLORS.BLACK, COLORS.WHITE);
    assert.equal(c.whiteMs, 12_000);
    assert.equal(c.blackMs, 12_000);
});

