/**
 * Module worker: loads wasm and runs persona searchBestMove off the UI thread.
 */

let ready = null;

async function ensureWasm() {
    if (ready) return ready;
    ready = (async () => {
        const m = await import('/pkg/shatrunz_wasm.js');
        if (typeof m.default === 'function') {
            await m.default();
        }
        return m;
    })();
    return ready;
}

self.onmessage = async (ev) => {
    const msg = ev.data || {};
    if (msg.type !== 'search') return;
    try {
        const m = await ensureWasm();
        const game = m.WasmGame.fromUciMoves(msg.uciMoves || []);
        const result = m.searchBestMove(game, msg.opts || {});
        self.postMessage({ type: 'result', result });
    } catch (err) {
        self.postMessage({
            type: 'error',
            message: err?.message || String(err),
        });
    }
};
