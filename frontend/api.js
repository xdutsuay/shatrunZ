// API client for backend communication
//
// Important for deployability:
// - Use a relative base URL so this works on localhost *and* when hosted behind a domain/reverse-proxy.
const API_BASE = '/api';

const DEFAULT_TIMEOUT_MS = 8000;

export class BackendAPI {
    static async saveGame(gameData) {
        try {
            const response = await fetch(`${API_BASE}/save-game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gameData)
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to save game:', error);
            return { success: false, error: error.message };
        }
    }

    static async saveBrain(brainData) {
        try {
            const response = await fetch(`${API_BASE}/save-brain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(brainData)
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to save brain:', error);
            return { success: false, error: error.message };
        }
    }

    static async loadBrain(name) {
        try {
            const response = await fetch(`${API_BASE}/load-brain/${name}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to load brain:', error);
            return { success: false, error: error.message };
        }
    }

    static async analyzeGame(gameData) {
        try {
            const response = await fetch(`${API_BASE}/analyze-game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gameData)
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to analyze game:', error);
            return { success: false, error: error.message };
        }
    }

    static async getGames() {
        try {
            const response = await fetch(`${API_BASE}/games`);
            return await response.json();
        } catch (error) {
            console.error('Failed to get games:', error);
            return { success: false, error: error.message };
        }
    }

    static async getEngineMove(moves = [], depth = 5, randomness = 0, fen = null, movetime = null, clockOpts = {}) {
        try {
            const controller = new AbortController();
            const { wtime, btime, winc, binc } = clockOpts;
            let timeoutMs = DEFAULT_TIMEOUT_MS;
            if (wtime != null || btime != null) {
                const sideRemaining = Math.max(wtime ?? 0, btime ?? 0, 30000);
                timeoutMs = Math.max(sideRemaining + 2000, 30000);
            } else if (movetime != null && movetime > 0) {
                timeoutMs = Math.max(movetime + 2000, 10000);
            }
            const t = setTimeout(() => controller.abort(), timeoutMs);
            const body = { moves, depth, randomness, fen };
            if (movetime != null && movetime > 0) body.movetime = movetime;
            if (wtime != null) body.wtime = wtime;
            if (btime != null) body.btime = btime;
            if (winc != null) body.winc = winc;
            if (binc != null) body.binc = binc;
            const response = await fetch(`${API_BASE}/engine-move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(t);
            return await response.json();
        } catch (error) {
            console.error('Failed to get engine move:', error);
            return { success: false, error: error.message };
        }
    }

    /** Stream NDJSON search updates: { type: 'info'|'bestmove', depth?, cp?, pv?, move? } */
    static async *streamEngineSearch(moves = [], depth = 5, randomness = 0, clockOpts = {}) {
        const body = { moves, depth, randomness, stream: true, ...clockOpts };
        const response = await fetch(`${API_BASE}/engine-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    yield JSON.parse(line);
                } catch (_) { /* skip */ }
            }
        }
    }

    static async inspectorAnalyze(gameData) {
        const response = await fetch(`${API_BASE}/inspector/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameData),
        });
        return response.json();
    }

    static async inspectorBulk() {
        const response = await fetch(`${API_BASE}/inspector/bulk`, { method: 'POST' });
        return response.json();
    }

    static async getStatsSummary() {
        try {
            const response = await fetch(`${API_BASE}/stats/summary`);
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async checkHealth() {
        try {
            const response = await fetch(`${API_BASE}/health`);
            return await response.json();
        } catch (error) {
            return { status: 'offline', error: error.message };
        }
    }
}
