/**
 * Wasm bootstrap for browser (`/pkg`) and Node (`../pkg-node`).
 * Call `await initWasm()` once before constructing Game / AI search.
 */

let _mod = null;
let _initPromise = null;

function isNode() {
    return typeof process !== 'undefined' && process.versions?.node;
}

/**
 * Load and initialize the wasm module (idempotent).
 * @returns {Promise<object>} wasm exports (WasmGame, searchBestMove, …)
 */
export async function initWasm() {
    if (_mod) return _mod;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        if (isNode()) {
            // nodejs target loads .wasm synchronously; no default() init.
            const url = new URL('../pkg-node/shatrunz_wasm.js', import.meta.url);
            _mod = await import(url.href);
        } else {
            const m = await import('/pkg/shatrunz_wasm.js');
            // web target: default export is the init function
            if (typeof m.default === 'function') {
                await m.default();
            }
            _mod = m;
        }
        return _mod;
    })();

    try {
        return await _initPromise;
    } catch (err) {
        _initPromise = null;
        throw err;
    }
}

/** @returns {object} wasm module; throws if initWasm() not awaited yet */
export function getWasm() {
    if (!_mod) {
        throw new Error('shatrunz wasm not initialized — await initWasm() first');
    }
    return _mod;
}

export function isWasmReady() {
    return _mod != null;
}
