/**
 * Hyper-train: rotate strategy pairs, update persona_* brains.
 */
import { COLORS } from '../constants.js';
import { AIPlayer } from '../ai.js';
import { PGNManager } from '../pgn.js';
import { GameSession } from './game_session.js';
import { brainNameFor } from './brain_utils.js';
import { getSettings } from './settings_store.js';
import { hyperTrainPairings } from './persona.js';

let cancelFlag = false;

export function cancelHyperTrain() {
    cancelFlag = true;
}

export async function runHyperTrain() {
    cancelFlag = false;
    const overlay = document.getElementById('training-overlay');
    const bar = document.getElementById('train-progress');
    const status = document.getElementById('train-status');
    if (overlay) overlay.style.display = 'flex';

    const s = getSettings();
    const countEl = document.getElementById('hyper-games-count');
    const GAMES = Math.max(1, Math.min(500, Number(countEl?.value) || s.hyperTrainGames || 50));
    const selected = [...document.querySelectorAll('.hyper-strategy:checked')].map((el) => el.value);
    const strategies = selected.length >= 2 ? selected : ['material', 'positional', 'aggressive'];
    const swapColors = document.getElementById('hyper-swap-colors')?.checked ?? s.hyperRotateColors ?? true;
    const pairs = hyperTrainPairings(strategies);
    const gamesPerPair = Math.max(1, Math.floor(GAMES / pairs.length));
    let gameIndex = 0;

    const pgn = new PGNManager();

    try {
        for (const [sWhite, sBlack] of pairs) {
            for (let g = 0; g < gamesPerPair && !cancelFlag; g++) {
                const swapInterval = Number(document.getElementById('hyper-swap-interval')?.value || 1);
                const swap = swapColors && swapInterval > 0 && Math.floor(g / swapInterval) % 2 === 1;
                const wStrat = swap ? sBlack : sWhite;
                const bStrat = swap ? sWhite : sBlack;
                const level = 2;

                const aiW = new AIPlayer(level, wStrat, brainNameFor({ strategy: wStrat }));
                const aiB = new AIPlayer(level, bStrat, brainNameFor({ strategy: bStrat }));

                const session = new GameSession({
                    pgnManager: pgn,
                    getMode: () => 'training',
                    getAiState: () => ({ ai1: aiW, ai2: aiB, currentAI: aiW }),
                    isAiTurnFn: () => true,
                });

                session.reset();
                pgn.startNewGame(`${wStrat} AI`, `${bStrat} AI`, 'training');
                let moves = 0;
                gameIndex++;

                if (status) status.innerText = `Game ${gameIndex}/${GAMES} (${wStrat} vs ${bStrat})`;
                if (bar) bar.style.width = `${(gameIndex / GAMES) * 100}%`;

                while (!session.game.gameOver && moves < 150 && !cancelFlag) {
                    const ai = session.game.turn === COLORS.WHITE ? aiW : aiB;
                    const m = await ai.getBestMove(session.game, session.game.turn, true);
                    if (!m) break;
                    session.executeAndRecordMove(m.from, m.to);
                    moves++;
                    const st = session.game.checkStatus();
                    if (st.over) {
                        session.finalizeTrainingGame(st);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Hyper-train failed:', err);
        if (status) status.innerText = `Stopped: ${err.message}`;
    } finally {
        if (overlay) overlay.style.display = 'none';
        if (status) status.innerText = `Done. ${gameIndex} games trained.`;
    }
}
