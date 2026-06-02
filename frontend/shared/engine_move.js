import { COLORS } from '../constants.js';
import { BackendAPI } from '../api.js';
import { parseUCIMove } from './uci.js';
import { getSettings } from './settings_store.js';
import { computeGoTimeMs, clockFieldsForSide } from './clock_budget.js';
import {
    ENGINE_PERSONAS,
    depthForLevel,
    PERSONA_C_NATIVE,
} from './persona.js';

let clockProvider = null;

export function setClockProvider(fn) {
    clockProvider = fn;
}

export function getEnginePersonaForSide(side = 'solo') {
    const s = getSettings();
    if (side === 'white') {
        const el = document.getElementById('white-ai-strategy');
        if (el?.value) return el.value;
        return s.whiteEnginePersona || 'material';
    }
    if (side === 'black') {
        const el = document.getElementById('black-ai-strategy');
        if (el?.value) return el.value;
        return s.blackEnginePersona || 'positional';
    }
    return s.enginePersona || 'material';
}

export function isPersonaCNative(personaId) {
    return personaId === PERSONA_C_NATIVE;
}

export function strategyForPersona(personaId) {
    const p = ENGINE_PERSONAS.find((x) => x.id === personaId);
    return p?.strategy || 'material';
}

export function searchParamsFromSettings() {
    const s = getSettings();
    const depth = depthForLevel(s.aiLevel);
    const randomness = s.randomness ? 50 : 0;
    let movetimeMs = s.thinkTimeMs || 0;
    if (movetimeMs <= 0) {
        movetimeMs = 2000 + depth * 400;
    }
    if (s.enableClocks && s.clockIncrementMs > 0) {
        movetimeMs = Math.max(movetimeMs, s.clockIncrementMs);
    }
    return { depth, randomness, movetimeMs };
}

function clockSearchOpts(turn) {
    const s = getSettings();
    if (!s.enableClocks || !clockProvider) return {};
    const { clock, incrementMs } = clockProvider();
    return clockFieldsForSide(clock, turn, incrementMs);
}

function jsBudgetMs(turn) {
    const s = getSettings();
    if (!s.enableClocks || !clockProvider) return 0;
    const { clock, incrementMs } = clockProvider();
    const fields = clockFieldsForSide(clock, turn, incrementMs);
    return computeGoTimeMs({ ...fields, side: turn });
}

export async function getCEngineMove(uciMoveHistory, turn, { onSearchUpdate } = {}) {
    const { depth, randomness, movetimeMs } = searchParamsFromSettings();
    const clockOpts = clockSearchOpts(turn);
    const useStream = typeof onSearchUpdate === 'function';

    if (useStream) {
        let best = null;
        let lastInfoAt = 0;
        for await (const evt of BackendAPI.streamEngineSearch(
            uciMoveHistory, depth, randomness, clockOpts,
        )) {
            if (evt.type === 'info') {
                const now = performance.now();
                if (now - lastInfoAt >= 200) {
                    lastInfoAt = now;
                    onSearchUpdate(evt);
                }
            }
            if (evt.type === 'bestmove' && evt.move) {
                best = parseUCIMove(evt.move);
            }
        }
        return best;
    }

    const useClock = clockOpts.wtime > 0 || clockOpts.btime > 0;
    const response = await BackendAPI.getEngineMove(
        uciMoveHistory,
        depth,
        randomness,
        null,
        useClock ? null : (movetimeMs > 0 ? movetimeMs : null),
        clockOpts,
    );
    if (response.success && response.move) {
        return parseUCIMove(response.move);
    }
    return null;
}

export async function getPvaiEngineMove({ game, uciMoveHistory, currentAI, personaId, onSearchUpdate }) {
    const pid = personaId || getEnginePersonaForSide('solo');
    if (isPersonaCNative(pid)) {
        try {
            const parsed = await getCEngineMove(uciMoveHistory, game.turn, { onSearchUpdate });
            if (parsed) return parsed;
        } catch (error) {
            console.error('Engine request failed:', error);
        }
    }
    return currentAI.getBestMove(game, game.turn, false, {
        uciPrefix: uciMoveHistory,
        budgetMs: jsBudgetMs(game.turn),
        onSearchUpdate,
    });
}

export async function getMoveForTurn({
    game, ai1, ai2, turn, uciMoveHistory = [], whitePersona, blackPersona, onSearchUpdate,
}) {
    const wPid = whitePersona ?? getEnginePersonaForSide('white');
    const bPid = blackPersona ?? getEnginePersonaForSide('black');
    const personaId = turn === COLORS.WHITE ? wPid : bPid;

    if (isPersonaCNative(personaId)) {
        const parsed = await getCEngineMove(uciMoveHistory, turn, { onSearchUpdate });
        if (parsed) return parsed;
    }

    const aiToUse = turn === COLORS.WHITE ? ai1 : ai2;
    return aiToUse.getBestMove(game, game.turn, false, {
        uciPrefix: uciMoveHistory,
        budgetMs: jsBudgetMs(turn),
        onSearchUpdate,
    });
}

export function getJsMoveForTurn({ game, ai1, ai2, turn, uciMoveHistory = [] }) {
    return getMoveForTurn({ game, ai1, ai2, turn, uciMoveHistory });
}
