import { COLORS } from '../constants.js';
import { BackendAPI } from '../api.js';
import { parseUCIMove } from './uci.js';

export async function getPvaiEngineMove({ game, uciMoveHistory, currentAI, useCEngine }) {
    const randomnessCheckbox = document.getElementById('add-randomness');
    const randomnessLevel = randomnessCheckbox?.checked ? 50 : 0;

    if (useCEngine) {
        try {
            const response = await BackendAPI.getEngineMove(uciMoveHistory, 5, randomnessLevel, null);
            if (response.success && response.move) {
                const parsedMove = parseUCIMove(response.move);
                if (parsedMove) return parsedMove;
            }
        } catch (error) {
            console.error('Engine request failed:', error);
        }
    }

    return currentAI.getBestMove(game, game.turn, false, { uciPrefix: uciMoveHistory });
}

export function getJsMoveForTurn({ game, ai1, ai2, turn, uciMoveHistory = [] }) {
    const aiToUse = turn === COLORS.WHITE ? ai1 : ai2;
    return aiToUse.getBestMove(game, game.turn, false, { uciPrefix: uciMoveHistory });
}
