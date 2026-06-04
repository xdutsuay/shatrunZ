import { COLORS } from '../constants.js';
import { formatEvalPawns } from './persona.js';

const files = 'abcdefghi';

function uciToSan(uci) {
    if (!uci || uci.length < 4) return uci || '';
    const fromC = files.indexOf(uci[0]);
    const fromR = 9 - parseInt(uci[1], 10);
    const toC = files.indexOf(uci[2]);
    const toR = 9 - parseInt(uci[3], 10);
    if (fromC < 0 || toC < 0) return uci;
    const toSq = `${files[toC]}${9 - toR}`;
    const cap = uci.length > 4;
    return cap ? `x${toSq}` : toSq;
}

function formatPvLine(evt) {
    const cp = evt.cp != null ? formatEvalPawns(evt.cp) : '—';
    const depth = evt.depth != null ? `d${evt.depth}` : '';
    const pv = Array.isArray(evt.pv) ? evt.pv.map(uciToSan).join(' ') : (evt.pvSan || '');
    return `<div class="engine-pv-line"><span class="engine-pv-score">${cp}</span><span class="engine-pv-depth">${depth}</span><span class="engine-pv-moves">${pv}</span></div>`;
}

export function clearEnginePv(side) {
    const el = side === COLORS.WHITE
        ? document.getElementById('engine-pv-bottom')
        : document.getElementById('engine-pv-top');
    if (el) el.innerHTML = '';
    resetPvThrottle();
}

export function renderEnginePv(side, events) {
    const el = side === COLORS.WHITE
        ? document.getElementById('engine-pv-bottom')
        : document.getElementById('engine-pv-top');
    if (!el) return;
    const lines = (events || []).slice(-3);
    el.innerHTML = lines.map(formatPvLine).join('');
}

const lastPvPaintAt = { w: 0, b: 0 };
const PV_THROTTLE_MS = 200;

export function handleSearchUpdate(side, evt) {
    if (!evt || evt.type !== 'info') return;
    const key = side === COLORS.WHITE ? 'w' : 'b';
    const now = performance.now();
    // The final line (the move that will actually be played) always paints,
    // bypassing the throttle, so the panel ends on the engine's real choice.
    if (!evt.final && now - lastPvPaintAt[key] < PV_THROTTLE_MS) return;
    lastPvPaintAt[key] = now;

    const el = side === COLORS.WHITE
        ? document.getElementById('engine-pv-bottom')
        : document.getElementById('engine-pv-top');
    if (!el) return;
    const row = formatPvLine(evt);
    const existing = el.querySelectorAll('.engine-pv-line');
    if (existing.length >= 3) {
        existing[0].remove();
    }
    el.insertAdjacentHTML('beforeend', row);
}

export function resetPvThrottle() {
    lastPvPaintAt.w = 0;
    lastPvPaintAt.b = 0;
}
