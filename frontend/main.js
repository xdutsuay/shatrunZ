import { initUI } from './ui.js';
import { MODES } from './mode_logic.js';

const ROUTE_TO_MODE = {
    '/pvp': MODES.HVH,
    '/pvai': MODES.HVC,
    '/aivai': MODES.CVC,
};

function modeFromPath() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    return ROUTE_TO_MODE[path] || null;
}

const mode = modeFromPath();
if (mode) {
    document.body.classList.add(`mode-${mode}`);
    initUI(mode);
}
