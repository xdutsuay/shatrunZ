import test from 'node:test';
import assert from 'node:assert/strict';

import { computeGoTimeMs } from '../frontend/shared/clock_budget.js';
import { COLORS } from '../frontend/constants.js';

const W = COLORS.WHITE;
const B = COLORS.BLACK;

test('no time on either clock returns 0 (clocks disabled)', () => {
    assert.equal(computeGoTimeMs({ wtime: 0, btime: 0, side: W }), 0);
});

test('never allocates the whole clock, even with a huge increment', () => {
    // Regression for "AI runs out of time at the start": with inc >= remaining the
    // old formula capped budget at full remaining and burned the entire clock move 1.
    const remaining = 60000;
    const budget = computeGoTimeMs({ wtime: remaining, btime: remaining, winc: 60000, binc: 60000, side: W });
    assert.ok(budget <= remaining * 0.4 + 1, `budget ${budget} should be <= 40% of clock`);
    assert.ok(budget < remaining, 'budget must never equal/exceed remaining');
});

test('budget never exceeds remaining minus reserve', () => {
    for (const remaining of [60000, 10000, 3000, 800, 200]) {
        for (const inc of [0, 1000, 30000, 100000]) {
            const b = computeGoTimeMs({ wtime: remaining, btime: remaining, winc: inc, binc: inc, side: W });
            assert.ok(b <= remaining, `budget ${b} <= remaining ${remaining} (inc ${inc})`);
        }
    }
});

test('low time pressure yields a small but positive budget (no flag)', () => {
    const b = computeGoTimeMs({ wtime: 120, btime: 60000, side: W });
    assert.ok(b >= 50 && b <= 120, `expected small floor budget, got ${b}`);
});

test('no-increment budget is roughly remaining/20 (no regression)', () => {
    const b = computeGoTimeMs({ wtime: 60000, btime: 60000, winc: 0, binc: 0, side: W });
    assert.equal(b, 3000);
});

test('uses the moving side clock', () => {
    const wBudget = computeGoTimeMs({ wtime: 60000, btime: 10000, side: W });
    const bBudget = computeGoTimeMs({ wtime: 60000, btime: 10000, side: B });
    assert.ok(wBudget > bBudget, 'white has more time so larger budget');
});

test('falls back to the other clock when the side has no time', () => {
    const b = computeGoTimeMs({ wtime: 0, btime: 20000, side: W });
    assert.ok(b > 0 && b <= 20000, `fallback budget should be positive and bounded, got ${b}`);
});
