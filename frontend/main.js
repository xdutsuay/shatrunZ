import { initUI } from './ui.js';
import { MODES } from './mode_logic.js';
import { initAdmin } from './admin_main.js';

const ROUTE_TO_MODE = {
    '/pvp': MODES.HVH,
    '/pvai': MODES.HVC,
    '/aivai': MODES.CVC,
};

function modeFromPath() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    return ROUTE_TO_MODE[path] || null;
}

const path = window.location.pathname.replace(/\/$/, '') || '/';
if (path === '/admin') {
    initAdmin();
} else {
    const mode = modeFromPath();
    if (mode) {
        document.body.classList.add(`mode-${mode}`);
        initUI(mode);
    }
}
