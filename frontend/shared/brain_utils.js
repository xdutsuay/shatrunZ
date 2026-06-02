import { COLORS } from '../constants.js';
import { MODES } from '../mode_logic.js';
import { BackendAPI } from '../api.js';

export { brainNameFor, personaBrainName, readPersonaStatsFromStorage } from './persona.js';

export function finalizeBrainsForResult({ mode, status, ai1, ai2, currentAI, isAiTurnFn }) {
    const winner = status.winner;
    let pgnResult;

    if (winner === COLORS.WHITE) {
        pgnResult = '1-0';
        if (mode === MODES.CVC) {
            ai1.brain.finalizeGame('win');
            ai2.brain.finalizeGame('loss');
        } else if (mode === MODES.HVC) {
            currentAI.brain.finalizeGame(isAiTurnFn() ? 'loss' : 'win');
        }
    } else if (winner === COLORS.BLACK) {
        pgnResult = '0-1';
        if (mode === MODES.CVC) {
            ai1.brain.finalizeGame('loss');
            ai2.brain.finalizeGame('win');
        } else if (mode === MODES.HVC) {
            currentAI.brain.finalizeGame(isAiTurnFn() ? 'loss' : 'win');
        }
    } else {
        pgnResult = '1/2-1/2';
        if (mode === MODES.CVC) {
            ai1.brain.finalizeGame('draw');
            ai2.brain.finalizeGame('draw');
        } else if (mode === MODES.HVC) {
            currentAI.brain.finalizeGame('draw');
        }
    }

    return pgnResult;
}

export async function persistGameAndBrains({
    pgnManager,
    uciMoveHistory,
    pgnResult,
    ai1,
    ai2,
    currentAI,
    mode,
}) {
    const saved = pgnManager.getGame(0);
    if (!saved) return;

    const payload = {
        pgn: pgnManager.exportPGN(saved),
        white: saved.white,
        black: saved.black,
        result: pgnResult,
        moves: saved.moves || [],
        uci_moves: [...uciMoveHistory],
        help_plies: saved.help_plies || [],
        help_summary: pgnManager.getHelpSummary(saved),
    };

    try {
        await BackendAPI.saveGame(payload);
        await BackendAPI.analyzeGame(payload);

        const brains = mode === MODES.CVC
            ? [ai1.brain, ai2.brain]
            : mode === MODES.HVC
                ? [currentAI.brain]
                : [];

        const seen = new Set();
        for (const brain of brains) {
            const data = brain.exportToJSON();
            const key = data.name || brain.name;
            if (seen.has(key)) continue;
            seen.add(key);
            await BackendAPI.saveBrain(data);
        }
    } catch (_) {
        // Non-blocking persistence
    }
}
