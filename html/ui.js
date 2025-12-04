import { BOARD_SIZE, FILES, COLORS, PIECES, SYMBOLS } from './constants.js';
import { Game } from './game.js';
import { Rules } from './rules.js';
import { AIPlayer } from './ai.js';

// --- UI Controller ---
const MODES = { HVH: 'hvh', HVC: 'hvc', CVC: 'cvc' };
let currentMode = MODES.HVH;
let game = new Game();
let ai = new AIPlayer(3);
let autoRunning = false;
let isTraining = false;
let selectedSq = null;
let legalMoves = [];

// DOM Elements
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('scoreboard');
const brainStatsEl = document.getElementById('brain-stats');
const thinkEl = document.getElementById('thinking-indicator');

// --- Initialization ---
export function initUI() {
    renderBoard();
    updateStatus();
    updateBrainStats();
}

function updateBrainStats() {
    const size = Object.keys(ai.brain.memory).length;
    brainStatsEl.innerText = `Brain: ${size} positions`;
}

// --- Rendering ---
function renderBoard() {
    if (isTraining) return; // Skip rendering during training

    boardEl.innerHTML = ''; // Full clear to prevent ghosting
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const sq = document.createElement('div');
            sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            sq.onclick = () => handleSquareClick(r, c);

            // Coords
            if (c === 0) {
                const t = document.createElement('span'); t.className = 'coord rank'; t.innerText = 9 - r; sq.appendChild(t);
            }
            if (r === 8) {
                const t = document.createElement('span'); t.className = 'coord file'; t.innerText = FILES[c]; sq.appendChild(t);
            }

            // Highlights
            if (selectedSq && selectedSq.r === r && selectedSq.c === c) sq.classList.add('selected');
            const lastMove = game.moveHistory[game.moveHistory.length - 1];
            if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
                sq.classList.add('last-move');
            }

            // Legal Move Hints
            const isLegal = legalMoves.find(m => m.r === r && m.c === c);
            if (isLegal) {
                if (game.board[r][c]) sq.classList.add('capture-move');
                else sq.classList.add('legal-move');
            }

            // Piece
            const p = game.board[r][c];
            if (p) {
                const d = document.createElement('div');
                d.className = `piece ${p.color === 'w' ? 'white-piece' : 'black-piece'} ${p.type === PIECES.KRISHNA ? 'krishna' : ''}`;
                d.innerText = SYMBOLS[p.color][p.type];
                sq.appendChild(d);
            }
            boardEl.appendChild(sq);
        }
    }
}

// --- Interaction ---
function handleSquareClick(r, c) {
    if (game.gameOver || autoRunning || isTraining) return;
    if (currentMode === MODES.CVC) return;
    if (currentMode === MODES.HVC && isAiTurn()) return;

    // Move
    const move = legalMoves.find(m => m.r === r && m.c === c);
    if (move) {
        game.executeMove(selectedSq, move);
        selectedSq = null; legalMoves = [];
        renderBoard();
        updateStatus();

        // Trigger AI if needed
        if (currentMode === MODES.HVC && !game.gameOver) {
            triggerAiMove();
        }
        return;
    }

    // Select
    const p = game.board[r][c];
    if (p && p.color === game.turn) {
        selectedSq = { r, c };
        legalMoves = Rules.getLegalMoves(game.board, r, c);
        renderBoard();
    } else {
        selectedSq = null; legalMoves = [];
        renderBoard();
    }
}

function isAiTurn() {
    const aiColor = document.getElementById('computer-side').value === 'white' ? COLORS.WHITE : COLORS.BLACK;
    return game.turn === aiColor;
}

// --- Undo Logic ---
document.getElementById('btn-undo').onclick = () => {
    if (autoRunning || isTraining || game.gameOver) return;

    // Logic: 
    // PvP: Undo 1 move.
    // PvAI: Undo 2 moves (AI's move, then Human's move) so it's Human's turn again.

    if (currentMode === MODES.HVH) {
        if (game.undoLastMove()) {
            selectedSq = null; legalMoves = [];
            renderBoard(); updateStatus();
        }
    } else if (currentMode === MODES.HVC) {
        // If it's human turn, undo AI then undo Human
        // If it's AI turn (rarely happens unless stuck), undo 1
        if (!isAiTurn()) {
            game.undoLastMove(); // Undo AI
            game.undoLastMove(); // Undo Human
            selectedSq = null; legalMoves = [];
            renderBoard(); updateStatus();
        }
    }
};


// --- AI Execution ---
async function triggerAiMove() {
    if (game.gameOver) return;
    thinkEl.innerText = 'Thinking...';
    // Small delay to let UI render the human move
    await new Promise(r => setTimeout(r, 50));

    const aiColor = game.turn; // It's AI's turn
    const move = await ai.getBestMove(game, aiColor);

    thinkEl.innerText = '';

    if (move) {
        game.executeMove(move.from, move.to);
        renderBoard();
        updateStatus();

        // CVC Loop
        if (currentMode === MODES.CVC && autoRunning && !game.gameOver) {
            setTimeout(triggerAiMove, 500);
        }
    } else {
        console.log("AI has no moves (should be caught by checkStatus)");
    }
}

// --- Game Control & Status ---
function updateStatus() {
    const status = game.checkStatus();
    if (status.over) {
        game.gameOver = true;
        statusEl.innerText = status.msg;
        autoRunning = false;
        document.getElementById('start-auto').disabled = false;
        document.getElementById('stop-auto').disabled = true;

        // Learn
        if (status.winner) ai.brain.finalizeGame('win'); // Simplistic learning trigger
        else ai.brain.finalizeGame('draw');
        updateBrainStats();
    } else {
        statusEl.innerText = status.msg;
    }

    // Score
    const score = game.getScore();
    const txt = score === 0 ? "Equal" : (score > 0 ? `White +${score}` : `Black +${Math.abs(score)}`);
    scoreEl.innerText = `Material: ${txt}`;
}

// --- Mode Switching ---
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');

    // Reset
    autoRunning = false;
    game = new Game();
    selectedSq = null; legalMoves = [];
    renderBoard(); updateStatus();

    document.getElementById('start-auto').disabled = (mode === MODES.HVH);
    document.getElementById('stop-auto').disabled = true;
}

document.getElementById('mode-hvh').onclick = () => setMode(MODES.HVH);
document.getElementById('mode-hvc').onclick = () => setMode(MODES.HVC);
document.getElementById('mode-cvc').onclick = () => setMode(MODES.CVC);

document.getElementById('reset-game').onclick = () => {
    autoRunning = false;
    game = new Game();
    renderBoard(); updateStatus();
};

document.getElementById('reset-brain').onclick = () => { ai.brain.clear(); updateBrainStats(); };
document.getElementById('ai-level').oninput = (e) => {
    document.getElementById('ai-level-label').innerText = e.target.value;
    ai.setLevel(parseInt(e.target.value));
};

document.getElementById('start-auto').onclick = () => {
    autoRunning = true;
    document.getElementById('start-auto').disabled = true;
    document.getElementById('stop-auto').disabled = false;
    triggerAiMove();
};

document.getElementById('stop-auto').onclick = () => {
    autoRunning = false;
    document.getElementById('start-auto').disabled = false;
    document.getElementById('stop-auto').disabled = true;
};

document.getElementById('computer-side').onchange = () => {
    if (currentMode === MODES.HVC && isAiTurn() && !game.gameOver) {
        triggerAiMove();
    }
};

// --- Hyper Training ---
document.getElementById('btn-hyper-train').onclick = async () => {
    if (isTraining) return;
    isTraining = true;
    autoRunning = false;

    const overlay = document.getElementById('training-overlay');
    const bar = document.getElementById('train-progress');
    const status = document.getElementById('train-status');
    const cancelBtn = document.getElementById('cancel-train');
    overlay.style.display = 'flex';

    const GAMES_TO_TRAIN = 50;
    const oldLevel = ai.level;
    ai.setLevel(2); // Fast

    let cancelled = false;
    cancelBtn.onclick = () => { cancelled = true; };

    for (let i = 1; i <= GAMES_TO_TRAIN; i++) {
        if (cancelled) break;
        game = new Game(); // New game
        let moves = 0;

        status.innerText = `Simulating Game ${i}/${GAMES_TO_TRAIN}`;
        bar.style.width = `${(i / GAMES_TO_TRAIN) * 100}%`;

        while (!game.gameOver && moves < 150) {
            const m = await ai.getBestMove(game, game.turn, true);
            if (m) {
                game.executeMove(m.from, m.to);
                const st = game.checkStatus();
                if (st.over) {
                    if (st.winner) ai.brain.finalizeGame('win'); // Simply reinforce winning
                    else ai.brain.finalizeGame('draw');
                    game.gameOver = true;
                }
            } else break;
            moves++;
            if (moves % 20 === 0) await new Promise(r => setTimeout(r, 0));
        }
    }

    isTraining = false;
    overlay.style.display = 'none';
    ai.setLevel(oldLevel);
    updateBrainStats();
    // Start fresh game for user
    game = new Game();
    renderBoard(); updateStatus();
};
