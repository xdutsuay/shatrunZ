import test from 'node:test';
import assert from 'node:assert/strict';

import { parseUCIMove } from '../frontend/shared/uci.js';

test('parseUCIMove returns null for engine null-move sentinel', () => {
    assert.equal(parseUCIMove('0000'), null);
});

