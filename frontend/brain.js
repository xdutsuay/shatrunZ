import { BOARD_SIZE, COLORS, PIECES, WEIGHTS } from './constants.js';
import { legacyBrainNamesForPersona } from './shared/persona.js';

// --- Game Brain with Persistent Storage ---
export class GameBrain {
    constructor(name = 'default') {
        this.name = name;
        this.memoryKey = `shatrunz_brain_${name}_v3`;
        this.migrateLegacyPersonaKeys();
        this.memory = this.loadMemory();
        this.valueKey = `shatrunz_value_${name}_v1`;
        this.values = this.loadValues(); // position hash -> value
        this.history = [];
        this.positionTrace = []; // position hashes for value learning
        this.stats = this.loadStats();
    }

    migrateLegacyPersonaKeys() {
        if (!this.name.startsWith('persona_')) return;
        const legacy = legacyBrainNamesForPersona(this.name);
        if (legacy.length === 0) return;

        let memory = this._readJson(this.memoryKey, {});
        let values = this._readJson(this.valueKey, {});
        let stats = this._readJson(`${this.memoryKey}_stats`, { wins: 0, losses: 0, draws: 0, games: 0 });

        for (const oldName of legacy) {
            const oldMemKey = `shatrunz_brain_${oldName}_v3`;
            const oldValKey = `shatrunz_value_${oldName}_v1`;
            const oldStatsKey = `${oldMemKey}_stats`;
            const om = this._readJson(oldMemKey, {});
            const ov = this._readJson(oldValKey, {});
            const os = this._readJson(oldStatsKey, null);
            for (const [h, moves] of Object.entries(om)) {
                if (!memory[h]) memory[h] = {};
                for (const [m, v] of Object.entries(moves)) {
                    memory[h][m] = (memory[h][m] || 0) + v;
                }
            }
            for (const [h, v] of Object.entries(ov)) {
                values[h] = (values[h] || 0) + v;
            }
            if (os) {
                stats.wins += os.wins || 0;
                stats.losses += os.losses || 0;
                stats.draws += os.draws || 0;
                stats.games += os.games || 0;
            }
        }

        try {
            localStorage.setItem(this.memoryKey, JSON.stringify(memory));
            localStorage.setItem(`${this.memoryKey}_stats`, JSON.stringify(stats));
            localStorage.setItem(this.valueKey, JSON.stringify(values));
        } catch (e) {
            console.warn('Persona migration save failed:', e);
        }
    }

    _readJson(key, fallback) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch {
            return fallback;
        }
    }

    loadMemory() {
        try {
            const data = localStorage.getItem(this.memoryKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to load brain memory:', e);
            return {};
        }
    }

    loadStats() {
        try {
            const data = localStorage.getItem(`${this.memoryKey}_stats`);
            return data ? JSON.parse(data) : { wins: 0, losses: 0, draws: 0, games: 0 };
        } catch (e) {
            return { wins: 0, losses: 0, draws: 0, games: 0 };
        }
    }

    loadValues() {
        try {
            const data = localStorage.getItem(this.valueKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    saveMemory() {
        try {
            localStorage.setItem(this.memoryKey, JSON.stringify(this.memory));
            localStorage.setItem(`${this.memoryKey}_stats`, JSON.stringify(this.stats));
            localStorage.setItem(this.valueKey, JSON.stringify(this.values));
        } catch (e) {
            console.error('Failed to save brain memory:', e);
        }
    }

    clear() {
        this.memory = {};
        this.values = {};
        this.stats = { wins: 0, losses: 0, draws: 0, games: 0 };
        localStorage.removeItem(this.memoryKey);
        localStorage.removeItem(`${this.memoryKey}_stats`);
        localStorage.removeItem(this.valueKey);
    }

    recordMove(hash, moveStr) {
        this.history.push({ hash, move: moveStr });
        this.positionTrace.push(hash);
    }

    abandonGame() {
        this.history = [];
        this.positionTrace = [];
    }

    /** Remove the last in-game move from training trace (undo). */
    rollbackLastMove() {
        if (this.history.length === 0) return false;
        this.history.pop();
        if (this.positionTrace.length > 0) {
            this.positionTrace.pop();
        }
        return true;
    }

    finalizeGame(result) {
        // result: 'win', 'loss', 'draw'
        if (this.history.length === 0) return;

        const reward = result === 'win' ? 10 : (result === 'loss' ? -10 : -2);
        let decay = 10;

        for (let i = this.history.length - 1; i >= 0 && decay > 0; i--) {
            const { hash, move } = this.history[i];
            if (!this.memory[hash]) this.memory[hash] = {};
            if (!this.memory[hash][move]) this.memory[hash][move] = 0;
            this.memory[hash][move] += reward;
            decay--;
        }

        // Update stats
        this.stats.games++;
        if (result === 'win') this.stats.wins++;
        else if (result === 'loss') this.stats.losses++;
        else this.stats.draws++;

        // --- Simple ML: value learning on position hashes (TD-style, terminal reward) ---
        // Store a scalar value per position hash and nudge it toward the terminal reward.
        // This is intentionally tiny + stable; it gives the AI a learned “feel” for positions.
        const target = reward; // terminal value
        const alpha = 0.05; // learning rate
        const maxTrace = 60;
        const trace = this.positionTrace.slice(-maxTrace);
        for (let i = 0; i < trace.length; i++) {
            const h = trace[i];
            const old = this.values[h] || 0;
            this.values[h] = old + alpha * (target - old);
        }

        this.saveMemory();
        this.history = [];
        this.positionTrace = [];

        // Note: Auto-export disabled - use manual Export Brain button instead
    }

    getBonus(hash, moveStr) {
        if (this.memory[hash] && this.memory[hash][moveStr]) {
            return this.memory[hash][moveStr] * 0.5;
        }
        return 0;
    }

    getPositionValue(hash) {
        return this.values[hash] || 0;
    }

    exportToJSON() {
        return {
            name: this.name,
            memory: this.memory,
            values: this.values,
            stats: this.stats,
            timestamp: Date.now(),
            version: 4
        };
    }

    importFromJSON(data) {
        if (data.version !== 3 && data.version !== 4) {
            console.warn('Incompatible brain version');
            return false;
        }
        this.memory = data.memory || {};
        this.values = data.values || {};
        this.stats = data.stats || { wins: 0, losses: 0, draws: 0, games: 0 };
        this.saveMemory();
        return true;
    }

    autoExport() {
        const data = this.exportToJSON();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `brain_${this.name}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    getStats() {
        return { ...this.stats };
    }

    getMemorySize() {
        return Object.keys(this.memory).length;
    }
}
