import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../frontend/constants.js';
import { computeGoTimeMs } from '../frontend/shared/clock_budget.js';

test('computeGoTimeMs matches UCI budget formula', () => {
    const ms = computeGoTimeMs({
        wtime: 180000,
        btime: 180000,
        winc: 2000,
        binc: 2000,
        side: COLORS.WHITE,
    });
    assert.equal(ms, 180000 / 20 + 2000);
});

test('computeGoTimeMs caps at remaining', () => {
    const ms = computeGoTimeMs({
        wtime: 40,
        btime: 180000,
        winc: 0,
        binc: 0,
        side: COLORS.WHITE,
    });
    assert.equal(ms, 40);
});
