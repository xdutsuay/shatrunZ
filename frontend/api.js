// API client for backend communication
//
// Important for deployability:
// - Use a relative base URL so this works on localhost *and* when hosted behind a domain/reverse-proxy.
const API_BASE = '/api';

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

    static async getEngineMove(moves = [], depth = 5, randomness = 0, fen = null) {
        try {
            const response = await fetch(`${API_BASE}/engine-move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moves, depth, randomness, fen })
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to get engine move:', error);
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
