import test from 'node:test';
import assert from 'node:assert/strict';

import { loserFromResult, openingPliesToReview } from '../tools/js/insight_heuristics.mjs';

test('loserFromResult', () => {
    assert.equal(loserFromResult('1-0'), 'b');
    assert.equal(loserFromResult('0-1'), 'w');
    assert.equal(loserFromResult('1/2-1/2'), null);
});

test('openingPliesToReview', () => {
    assert.deepEqual(openingPliesToReview(3, 10), [0, 1, 2]);
    assert.deepEqual(openingPliesToReview(12, 2), [0, 1]);
    assert.deepEqual(openingPliesToReview(5, 0), []);
});
