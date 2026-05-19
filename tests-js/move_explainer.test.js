import test from 'node:test';
import assert from 'node:assert/strict';

import { PIECES } from '../frontend/constants.js';
import { explainMove } from '../frontend/shared/move_explainer.js';

test('explainMove mentions capture for material persona', () => {
    const text = explainMove({
        move: { from: { r: 4, c: 4 }, to: { r: 3, c: 4 } },
        persona: 'material',
        captured: { type: PIECES.ROOK, color: 'b' },
        isCheck: false,
        isCheckmate: false,
    });
    assert.match(text, /Material AI/i);
    assert.match(text, /takes|captures|rook/i);
});

test('explainMove mentions check', () => {
    const text = explainMove({
        move: { from: { r: 4, c: 4 }, to: { r: 3, c: 4 } },
        persona: 'aggressive',
        captured: null,
        isCheck: true,
        isCheckmate: false,
    });
    assert.match(text, /check/i);
});

test('explainMove checkmate suffix', () => {
    const text = explainMove({
        move: { from: { r: 4, c: 4 }, to: { r: 3, c: 4 } },
        persona: 'positional',
        captured: null,
        isCheck: true,
        isCheckmate: true,
    });
    assert.match(text, /checkmate/i);
});
