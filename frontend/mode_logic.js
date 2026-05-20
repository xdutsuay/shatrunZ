import { COLORS } from './constants.js';

export const MODES = { HVH: 'hvh', HVC: 'hvc', CVC: 'cvc' };

export function getAiColor(computerSideValue) {
    return computerSideValue === 'white' ? COLORS.WHITE : COLORS.BLACK;
}

export function isAiTurn({ turn, computerSideValue }) {
    const aiColor = getAiColor(computerSideValue);
    return turn === aiColor;
}

export function shouldBlockHumanInput({ mode, gameOver, autoRunning, isTraining, turn, computerSideValue }) {
    if (gameOver || isTraining) return true;
    if (mode === MODES.CVC) return true;
    if (mode === MODES.HVC) return isAiTurn({ turn, computerSideValue });
    // HvH blocks only when game over or training; autoRunning is irrelevant.
    return false;
}

export function shouldTriggerAiMove({ mode, gameOver, autoRunning, turn, computerSideValue }) {
    if (gameOver || !autoRunning) return false;
    if (mode === MODES.CVC) return true;
    if (mode === MODES.HVC) return isAiTurn({ turn, computerSideValue });
    return false;
}

