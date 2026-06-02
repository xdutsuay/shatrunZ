const ls = typeof localStorage !== 'undefined'
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function bool(key, def = false) {
    const v = ls.getItem(key);
    if (v === null) return def;
    return v === '1';
}

function num(key, def = 0) {
    const v = ls.getItem(key);
    if (v === null || v === '') return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}

function str(key, def = '') {
    const v = ls.getItem(key);
    return v === null || v === '' ? def : String(v);
}

export const SettingsKeys = {
    enableClocks: 'shatrunz_clock_enabled',
    clockTotalMs: 'shatrunz_clock_total_ms',
    clockIncrementMs: 'shatrunz_clock_increment_ms',
    allowMidgamePersonaChange: 'shatrunz_allow_midgame_persona_change',

    enableHelp: 'shatrunz_enable_ai_help',
    autoHelp: 'shatrunz_ai_auto_help',

    aiLevel: 'shatrunz_ai_level',
    enginePersona: 'shatrunz_engine_persona',
    randomness: 'shatrunz_randomness',
    usePolicyNet: 'shatrunz_use_policy_net',
    enableMoveExplain: 'shatrunz_enable_move_explain',
    thinkTimeMs: 'shatrunz_think_time_ms',
};

export const ENGINE_PERSONAS = [
    { id: 'material', label: 'JS Material' },
    { id: 'positional', label: 'JS Positional' },
    { id: 'aggressive', label: 'JS Aggressive' },
    { id: 'c_native', label: 'C Engine (native)' },
];

export function getSettings() {
    return {
        enableClocks: bool(SettingsKeys.enableClocks, false),
        clockTotalMs: num(SettingsKeys.clockTotalMs, 0),
        clockIncrementMs: num(SettingsKeys.clockIncrementMs, 0),
        allowMidgamePersonaChange: bool(SettingsKeys.allowMidgamePersonaChange, false),

        enableHelp: bool(SettingsKeys.enableHelp, false),
        autoHelp: bool(SettingsKeys.autoHelp, false),

        aiLevel: num(SettingsKeys.aiLevel, 3),
        enginePersona: str(SettingsKeys.enginePersona, 'material'),
        randomness: bool(SettingsKeys.randomness, false),
        usePolicyNet: bool(SettingsKeys.usePolicyNet, false),
        enableMoveExplain: bool(SettingsKeys.enableMoveExplain, false),
        thinkTimeMs: num(SettingsKeys.thinkTimeMs, 0),
    };
}

export function setBool(key, value) {
    ls.setItem(key, value ? '1' : '0');
}

export function setNum(key, value) {
    const n = Number(value);
    ls.setItem(key, Number.isFinite(n) ? String(n) : '0');
}

export function setStr(key, value) {
    ls.setItem(key, String(value ?? ''));
}
