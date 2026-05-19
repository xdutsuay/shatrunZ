import test from 'node:test';
import assert from 'node:assert/strict';

import { ReplayStepController } from '../frontend/shared/replay_step.js';

test('ReplayStepController steps forward and back', () => {
    const moves = ['d2d3', 'd8d7', 'e2e3'];
    const rc = new ReplayStepController(moves);
    assert.equal(rc.ply, 0);
    assert.equal(rc.maxPly, 3);

    rc.stepForward();
    assert.equal(rc.ply, 1);
    assert.equal(rc.uciHistory.length, 1);

    rc.stepForward();
    rc.stepForward();
    assert.equal(rc.ply, 3);

    rc.stepBack();
    assert.equal(rc.ply, 2);
    assert.equal(rc.uciHistory.length, 2);

    rc.stepTo(0);
    assert.equal(rc.ply, 0);
    assert.equal(rc.game.moveHistory.length, 0);
});

test('ReplayStepController matches full replay at end', () => {
    const moves = ['d2d3', 'd8d7'];
    const rc = new ReplayStepController(moves);
    rc.stepTo(2);
    assert.equal(rc.game.moveHistory.length, 2);
});
