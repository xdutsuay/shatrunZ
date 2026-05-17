import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORS } from '../frontend/constants.js';
import { MODES, getAiColor, isAiTurn, shouldTriggerAiMove, shouldBlockHumanInput } from '../frontend/mode_logic.js';

test('getAiColor maps DOM value to color', () => {
    assert.equal(getAiColor('white'), COLORS.WHITE);
    assert.equal(getAiColor('black'), COLORS.BLACK);
    assert.equal(getAiColor(undefined), COLORS.BLACK);
});

test('isAiTurn matches turn vs computer-side', () => {
    assert.equal(isAiTurn({ turn: COLORS.WHITE, computerSideValue: 'white' }), true);
    assert.equal(isAiTurn({ turn: COLORS.BLACK, computerSideValue: 'white' }), false);
    assert.equal(isAiTurn({ turn: COLORS.WHITE, computerSideValue: 'black' }), false);
    assert.equal(isAiTurn({ turn: COLORS.BLACK, computerSideValue: 'black' }), true);
});

test('shouldTriggerAiMove gates autoplay correctly per mode', () => {
    // HvH never triggers AI
    assert.equal(shouldTriggerAiMove({ mode: MODES.HVH, gameOver: false, autoRunning: true, turn: COLORS.WHITE, computerSideValue: 'white' }), false);

    // HvC triggers only on AI turn
    assert.equal(shouldTriggerAiMove({ mode: MODES.HVC, gameOver: false, autoRunning: true, turn: COLORS.WHITE, computerSideValue: 'white' }), true);
    assert.equal(shouldTriggerAiMove({ mode: MODES.HVC, gameOver: false, autoRunning: true, turn: COLORS.BLACK, computerSideValue: 'white' }), false);
    assert.equal(shouldTriggerAiMove({ mode: MODES.HVC, gameOver: false, autoRunning: true, turn: COLORS.WHITE, computerSideValue: 'black' }), false);
    assert.equal(shouldTriggerAiMove({ mode: MODES.HVC, gameOver: false, autoRunning: true, turn: COLORS.BLACK, computerSideValue: 'black' }), true);

    // CvC triggers for both turns while autoRunning
    assert.equal(shouldTriggerAiMove({ mode: MODES.CVC, gameOver: false, autoRunning: true, turn: COLORS.WHITE, computerSideValue: 'white' }), true);
    assert.equal(shouldTriggerAiMove({ mode: MODES.CVC, gameOver: false, autoRunning: true, turn: COLORS.BLACK, computerSideValue: 'white' }), true);

    // Always false if stopped or game over
    assert.equal(shouldTriggerAiMove({ mode: MODES.CVC, gameOver: true, autoRunning: true, turn: COLORS.WHITE, computerSideValue: 'white' }), false);
    assert.equal(shouldTriggerAiMove({ mode: MODES.CVC, gameOver: false, autoRunning: false, turn: COLORS.WHITE, computerSideValue: 'white' }), false);
});

test('shouldBlockHumanInput blocks correctly (core regression: HvC blocks only on AI turn)', () => {
    assert.equal(shouldBlockHumanInput({ mode: MODES.HVC, gameOver: false, autoRunning: false, isTraining: false, turn: COLORS.WHITE, computerSideValue: 'black' }), false);
    assert.equal(shouldBlockHumanInput({ mode: MODES.HVC, gameOver: false, autoRunning: false, isTraining: false, turn: COLORS.WHITE, computerSideValue: 'white' }), true);
    assert.equal(shouldBlockHumanInput({ mode: MODES.CVC, gameOver: false, autoRunning: false, isTraining: false, turn: COLORS.WHITE, computerSideValue: 'white' }), true);
    assert.equal(shouldBlockHumanInput({ mode: MODES.HVH, gameOver: true, autoRunning: false, isTraining: false, turn: COLORS.WHITE, computerSideValue: 'white' }), true);
});

