import { initWasm } from './shared/wasm_boot.js';
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

async function boot() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path === '/admin') {
        initAdmin();
        return;
    }

    const mode = modeFromPath();
    if (!mode) return;

    await initWasm();
    document.body.classList.add(`mode-${mode}`);
    initUI(mode);
}

boot().catch((err) => {
    console.error('Failed to boot ShatrunZ wasm:', err);
    document.body.innerHTML = `<pre style="padding:2rem;color:#c00">Failed to load engine wasm.\n${err}</pre>`;
});
