import { BOARD_SIZE, COLORS, PIECES, WEIGHTS } from './constants.js';

// --- Game Brain with Persistent Storage ---
export class GameBrain {
    constructor(name = 'default') {
        this.name = name;
        this.memoryKey = `shatrunz_brain_${name}_v3`;
        this.memory = this.loadMemory();
        this.history = [];
        this.stats = this.loadStats();
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

    saveMemory() {
        try {
            localStorage.setItem(this.memoryKey, JSON.stringify(this.memory));
            localStorage.setItem(`${this.memoryKey}_stats`, JSON.stringify(this.stats));
        } catch (e) {
            console.error('Failed to save brain memory:', e);
        }
    }

    clear() {
        this.memory = {};
        this.stats = { wins: 0, losses: 0, draws: 0, games: 0 };
        localStorage.removeItem(this.memoryKey);
        localStorage.removeItem(`${this.memoryKey}_stats`);
    }

    recordMove(hash, moveStr) {
        this.history.push({ hash, move: moveStr });
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

        this.saveMemory();
        this.history = [];

        // Note: Auto-export disabled - use manual Export Brain button instead
    }

    getBonus(hash, moveStr) {
        if (this.memory[hash] && this.memory[hash][moveStr]) {
            return this.memory[hash][moveStr] * 0.5;
        }
        return 0;
    }

    exportToJSON() {
        return {
            name: this.name,
            memory: this.memory,
            stats: this.stats,
            timestamp: Date.now(),
            version: 3
        };
    }

    importFromJSON(data) {
        if (data.version !== 3) {
            console.warn('Incompatible brain version');
            return false;
        }
        this.memory = data.memory || {};
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
