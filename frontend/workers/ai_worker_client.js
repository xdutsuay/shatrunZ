/**
 * Main-thread client for the AI wasm worker.
 * Falls back by throwing so AIPlayer uses in-process searchBestMove.
 */

import { moveToUCI } from '../shared/uci.js';

function uciMovesFromGame(game) {
    if (!Array.isArray(game?.moveHistory)) return [];
    return game.moveHistory
        .map((h) => moveToUCI(h.from, h.to, h.movedPiece))
        .filter(Boolean);
}

let _worker = null;
let _workerBroken = false;

function getWorker() {
    if (_workerBroken) return null;
    if (_worker) return _worker;
    if (typeof Worker === 'undefined') {
        _workerBroken = true;
        return null;
    }
    try {
        _worker = new Worker(new URL('./ai_worker.js', import.meta.url), { type: 'module' });
        return _worker;
    } catch {
        _workerBroken = true;
        return null;
    }
}

/**
 * @param {object} game
 * @param {object} searchOpts
 * @param {function} [_onSearchUpdate]
 * @returns {Promise<object>} searchBestMove result
 */
export function searchViaWorker(game, searchOpts, _onSearchUpdate) {
    const worker = getWorker();
    if (!worker) {
        return Promise.reject(new Error('ai worker unavailable'));
    }

    const uciMoves = uciMovesFromGame(game);
    return new Promise((resolve, reject) => {
        const onMsg = (ev) => {
            const data = ev.data || {};
            if (data.type === 'error') {
                cleanup();
                _workerBroken = true;
                reject(new Error(data.message || 'worker error'));
                return;
            }
            if (data.type === 'result') {
                cleanup();
                resolve(data.result);
            }
        };
        const onErr = (err) => {
            cleanup();
            _workerBroken = true;
            reject(err);
        };
        const cleanup = () => {
            worker.removeEventListener('message', onMsg);
            worker.removeEventListener('error', onErr);
        };
        worker.addEventListener('message', onMsg);
        worker.addEventListener('error', onErr);
        worker.postMessage({ type: 'search', uciMoves, opts: searchOpts });
    });
}
