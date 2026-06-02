import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../frontend/constants.js';
import { buildMoveListHtml } from '../frontend/shared/move_list.js';

test('move list places black-first ply in black column', () => {
    const game = {
        moves: ['Ba4', 'e4'],
        move_sides: [COLORS.BLACK, COLORS.WHITE],
    };
    const html = buildMoveListHtml(game, 1);
    assert.match(html, /1\.\.\./);
    assert.match(html, />Ba4</);
    assert.doesNotMatch(html, /<td class="move-cell">Ba4<\/td>/);
});

test('move list white then black in correct columns', () => {
    const game = {
        moves: ['e4', 'e5'],
        move_sides: [COLORS.WHITE, COLORS.BLACK],
    };
    const html = buildMoveListHtml(game, 2);
    assert.match(html, /1\..*>e4</);
    assert.match(html, />e5</);
});
