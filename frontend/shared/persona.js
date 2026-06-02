import { getSettings } from './settings_store.js';

/** Persona / engine identity — one brain per strategy (not per board side). */

export const PERSONA_STRATEGIES = ['material', 'positional', 'aggressive'];
export const PERSONA_C_NATIVE = 'c_native';

export const ENGINE_PERSONAS = [
    { id: 'material', label: 'JS Material', kind: 'js', strategy: 'material' },
    { id: 'positional', label: 'JS Positional', kind: 'js', strategy: 'positional' },
    { id: 'aggressive', label: 'JS Aggressive', kind: 'js', strategy: 'aggressive' },
    { id: PERSONA_C_NATIVE, label: 'C Engine (native)', kind: 'c', strategy: 'material' },
];

export function personaBrainName(strategyOrPersona) {
    const s = (strategyOrPersona || 'material').toLowerCase();
    if (s === PERSONA_C_NATIVE || s === 'c_engine' || s === 'c') {
        return `persona_${PERSONA_C_NATIVE}`;
    }
    return `persona_${s}`;
}

export function brainNameFor({ strategy, personaId }) {
    if (personaId) {
        const p = ENGINE_PERSONAS.find((x) => x.id === personaId);
        if (p?.kind === 'c') return personaBrainName(PERSONA_C_NATIVE);
        if (p) return personaBrainName(p.strategy);
    }
    return personaBrainName(strategy || 'material');
}

/** Legacy localStorage keys merged into persona_* on load. */
export function legacyBrainNamesForPersona(personaName) {
    const strategy = personaName.replace(/^persona_/, '');
    if (strategy === PERSONA_C_NATIVE) {
        return ['cvc_white_material', 'cvc_black_material', 'training_white_material'];
    }
    const names = new Set();
    for (const mode of ['cvc', 'hvc', 'training']) {
        if (mode === 'hvc') {
            names.add(`hvc_solo_${strategy}`);
        } else {
            names.add(`${mode}_white_${strategy}`);
            names.add(`${mode}_black_${strategy}`);
        }
    }
    names.add(`${strategy}_ai`);
    names.add(`material_ai`);
    if (strategy === 'positional') names.add('positional_ai');
    return [...names].filter((n) => n !== personaName);
}

export function depthForLevel(level) {
    const lv = Math.max(1, Math.min(5, Number(level) || 3));
    const map = { 1: 4, 2: 6, 3: 8, 4: 10, 5: 12 };
    return map[lv] ?? 8;
}

export function levelToDepth(level) {
    return depthForLevel(level);
}

export function levelToJsDepth(level) {
    const lv = Math.max(1, Math.min(5, Number(level) || 3));
    const map = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 };
    return map[lv] ?? 6;
}

/** Minimum ms between plies when clocks off; zero when clocks on. */
export function minPlyDelayMs() {
    if (getSettings().enableClocks) return 0;
    const t = getSettings().thinkTimeMs;
    if (t > 0) return Math.min(t, 12000);
    return 800;
}

export function formatEvalPawns(cp) {
    if (cp == null || Number.isNaN(cp)) return '—';
    const pawns = cp / 100;
    const sign = pawns > 0 ? '+' : '';
    return `${sign}${pawns.toFixed(1)}`;
}

export function formatMaterialPawns(materialCp) {
    return formatEvalPawns(materialCp);
}

export function personaLabel(personaName) {
    if (personaName === `persona_${PERSONA_C_NATIVE}`) return 'C Engine';
    const s = personaName.replace(/^persona_/, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function engineStatusLabel({ personaId, level, depth }) {
    const p = ENGINE_PERSONAS.find((x) => x.id === personaId) || ENGINE_PERSONAS[0];
    const d = depth ?? depthForLevel(level);
    if (p.kind === 'c') return `Engine: C native (depth ${d})`;
    return `Engine: ${p.label} (depth ${d})`;
}

export const HYPER_STRATEGIES = ['material', 'positional', 'aggressive'];

export function hyperTrainPairings(strategies = HYPER_STRATEGIES) {
    const pairs = [];
    for (let i = 0; i < strategies.length; i++) {
        for (let j = 0; j < strategies.length; j++) {
            if (i !== j) pairs.push([strategies[i], strategies[j]]);
        }
    }
    return pairs;
}

/** Aggregated persona stats for admin Stats tab. */
export function readPersonaStatsFromStorage() {
    const names = [
        'persona_material',
        'persona_positional',
        'persona_aggressive',
        'persona_c_native',
    ];
    const items = [];
    for (const name of names) {
        const statsKey = `shatrunz_brain_${name}_v3_stats`;
        try {
            const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(statsKey) : null;
            const stats = raw ? JSON.parse(raw) : { wins: 0, losses: 0, draws: 0, games: 0 };
            items.push({ name, stats, label: personaLabel(name) });
        } catch {
            items.push({ name, stats: { wins: 0, losses: 0, draws: 0, games: 0 }, label: personaLabel(name) });
        }
    }
    return items;
}
