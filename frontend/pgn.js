import { FILES, COLORS, PIECES } from './constants.js';
import { importPgnText, pgnImportToGameRecord } from './shared/pgn_parse.js';

// --- PGN Manager ---
export class PGNManager {
    constructor() {
        this.games = this.loadGames();
        this.currentGame = null;
    }

    startNewGame(white, black, mode) {
        this.currentGame = {
            event: "ShatrunZ Game",
            site: "Web Browser",
            date: new Date().toISOString().split('T')[0],
            round: "-",
            white: white,
            black: black,
            result: "*",
            variant: "9x9 ShatrunZ",
            fen: "rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - - 0 1",
            moves: [],
            uci_moves: [],
            help_plies: [],
            mode: mode
        };
    }

    /** Record a human-assisted ply (Help mode). */
    recordHelpMove(ply, side, uci, reason = '') {
        if (!this.currentGame) return;
        if (!this.currentGame.help_plies) this.currentGame.help_plies = [];
        this.currentGame.help_plies.push({ ply, side, uci, reason });
    }

    static encodeHelpMovesTag(helpPlies) {
        if (!helpPlies || helpPlies.length === 0) return '';
        return helpPlies.map(h => `${h.ply}:${h.side}:${h.uci}`).join(';');
    }

    static parseHelpMovesTag(raw) {
        if (!raw || !raw.trim()) return [];
        return raw.split(';').filter(Boolean).map((part) => {
            const [ply, side, uci] = part.split(':');
            return { ply: parseInt(ply, 10), side, uci, reason: '' };
        });
    }

    getHelpSummary(game = null) {
        const g = game || this.currentGame;
        if (!g?.help_plies?.length) return '';
        const w = g.help_plies.filter(h => h.side === 'w' || h.side === 'white').length;
        const b = g.help_plies.filter(h => h.side === 'b' || h.side === 'black').length;
        const total = g.help_plies.length;
        return `${total} human-helped ${total === 1 ? 'ply' : 'plies'} (White: ${w}, Black: ${b})`;
    }

    recordUciMove(uci) {
        if (!this.currentGame || !uci) return;
        this.currentGame.uci_moves.push(uci);
    }

    recordMove(from, to, piece, captured, isCheck, isCheckmate) {
        if (!this.currentGame) return;

        const notation = this.toAlgebraic(from, to, piece, captured, isCheck, isCheckmate);
        this.currentGame.moves.push(notation);
    }

    toAlgebraic(from, to, piece, captured, isCheck, isCheckmate) {
        const files = FILES.map(f => f.toLowerCase());
        const pieceSymbol = piece.type === PIECES.PAWN ? '' : piece.type.toUpperCase();
        const captureSymbol = captured ? 'x' : '';
        const toSquare = files[to.c] + (9 - to.r);
        const suffix = isCheckmate ? '#' : (isCheck ? '+' : '');

        // For pawns, include file if capturing
        if (piece.type === PIECES.PAWN && captured) {
            return `${files[from.c]}${captureSymbol}${toSquare}${suffix}`;
        }

        return `${pieceSymbol}${captureSymbol}${toSquare}${suffix}`;
    }

    endGame(result, uciMoves = null) {
        if (!this.currentGame) return;

        this.currentGame.result = result; // "1-0", "0-1", "1/2-1/2"
        if (uciMoves && uciMoves.length) {
            this.currentGame.uci_moves = [...uciMoves];
        }
        this.currentGame.endTime = new Date().toISOString();
        this.games.unshift(this.currentGame); // Add to beginning

        // Keep only last 50 games
        if (this.games.length > 50) {
            this.games = this.games.slice(0, 50);
        }

        this.saveGames();
        this.currentGame = null;
    }

    getCurrentMoves() {
        if (!this.currentGame) return [];
        return this.currentGame.moves;
    }

    /** Pop last algebraic + UCI ply from the active game (undo). */
    popLastMove() {
        if (!this.currentGame) return false;
        let changed = false;
        if (this.currentGame.moves.length > 0) {
            this.currentGame.moves.pop();
            changed = true;
        }
        if (this.currentGame.uci_moves.length > 0) {
            this.currentGame.uci_moves.pop();
            changed = true;
        }
        return changed;
    }

    getFormattedMoves() {
        if (!this.currentGame || this.currentGame.moves.length === 0) return '';

        let formatted = '';
        for (let i = 0; i < this.currentGame.moves.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            formatted += `${moveNum}. ${this.currentGame.moves[i]}`;
            if (this.currentGame.moves[i + 1]) {
                formatted += ` ${this.currentGame.moves[i + 1]}`;
            }
            formatted += ' ';
        }
        return formatted.trim();
    }

    exportPGN(game = null) {
        const gameData = game || this.currentGame;
        if (!gameData) return '';

        let pgn = '';

        // Headers
        const headers = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'Variant', 'FEN'];
        headers.forEach(key => {
            const value = gameData[key.toLowerCase()] || '?';
            pgn += `[${key} "${value}"]\n`;
        });

        if (gameData.uci_moves && gameData.uci_moves.length > 0) {
            pgn += `[UciMoves "${gameData.uci_moves.join(' ')}"]\n`;
        }

        const helpTag = PGNManager.encodeHelpMovesTag(gameData.help_plies);
        if (helpTag) {
            pgn += `[HelpMoves "${helpTag}"]\n`;
        }

        pgn += '\n';

        // Moves
        for (let i = 0; i < gameData.moves.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            pgn += `${moveNum}. ${gameData.moves[i]} `;
            if (gameData.moves[i + 1]) {
                pgn += `${gameData.moves[i + 1]} `;
            }
            if ((i + 2) % 16 === 0) pgn += '\n'; // New line every 8 moves
        }

        pgn += gameData.result;
        return pgn;
    }

    exportCurrentGame() {
        if (!this.currentGame) return;

        const pgn = this.exportPGN();
        const blob = new Blob([pgn], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shatrunz_${Date.now()}.pgn`;
        a.click();
        URL.revokeObjectURL(url);
    }

    loadGames() {
        try {
            const data = localStorage.getItem('shatrunz_pgn_history');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load game history:', e);
            return [];
        }
    }

    saveGames() {
        try {
            localStorage.setItem('shatrunz_pgn_history', JSON.stringify(this.games));
        } catch (e) {
            console.error('Failed to save game history:', e);
        }
    }

    getGameHistory() {
        return this.games.map((game, index) => ({
            index,
            white: game.white,
            black: game.black,
            result: game.result,
            date: game.date,
            moves: game.moves.length
        }));
    }

    getGame(index) {
        return this.games[index] || null;
    }

    clearHistory() {
        this.games = [];
        localStorage.removeItem('shatrunz_pgn_history');
    }

    /**
     * Parse PGN text and append to history.
     * @returns {{ ok: boolean, index?: number, error?: string }}
     */
    importPgnFile(text) {
        const parsed = importPgnText(text);
        if (parsed.error) return { ok: false, error: parsed.error };
        const record = pgnImportToGameRecord(parsed);
        if (!record.uci_moves.length && !record.moves.length) {
            return { ok: false, error: 'No moves found in PGN' };
        }
        this.games.unshift(record);
        if (this.games.length > 50) this.games = this.games.slice(0, 50);
        this.saveGames();
        return { ok: true, index: 0, game: record };
    }
}
