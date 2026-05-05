import { BOARD_SIZE, FILES, COLORS, PIECES, SYMBOLS } from './constants.js';
import { Game } from './game.js';
import { Rules } from './rules.js';
import { AIPlayer } from './ai.js';
import { PGNManager } from './pgn.js';
import { BackendAPI } from './api.js';

// --- UI Controller ---
const MODES = { HVH: 'hvh', HVC: 'hvc', CVC: 'cvc' };
let currentMode = MODES.HVH;
let game = new Game();

// Dual AI system for AIvAI
let ai1 = new AIPlayer(3, 'material', 'material_ai');
let ai2 = new AIPlayer(3, 'positional', 'positional_ai');
let currentAI = ai1; // For PvAI mode

let pgnManager = new PGNManager();
let autoRunning = false;
let isTraining = false;
let selectedSq = null;
let legalMoves = [];
let uciMoveHistory = [];

// DOM Elements
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('scoreboard');
const brainStatsEl = document.getElementById('brain-stats');
const thinkEl = document.getElementById('thinking-indicator');
const moveListEl = document.getElementById('move-list');
const opponentNameEl = document.getElementById('opponent-name');
const playerNameEl = document.getElementById('player-name');

// --- Initialization ---
export function initUI() {
    renderBoard();
    updateStatus();
    updateBrainStats();
    updateMoveList();
    setupEventListeners();
}

function setupEventListeners() {
    // Mode switching
    document.getElementById('mode-hvh').onclick = () => setMode(MODES.HVH);
    document.getElementById('mode-hvc').onclick = () => setMode(MODES.HVC);
    document.getElementById('mode-cvc').onclick = () => setMode(MODES.CVC);

    // Game controls
    document.getElementById('btn-undo').onclick = handleUndo;
    document.getElementById('reset-game').onclick = resetGame;

    // AI controls
    document.getElementById('ai-level').oninput = handleLevelChange;
    document.getElementById('ai-strategy').onchange = handleStrategyChange;
    document.getElementById('computer-side').onchange = handleSideChange;
    document.getElementById('start-auto').onclick = startAuto;
    document.getElementById('stop-auto').onclick = stopAuto;

    // Brain controls
    document.getElementById('reset-brain').onclick = resetBrain;
    document.getElementById('export-brain').onclick = exportBrain;
    document.getElementById('import-brain').onclick = () => document.getElementById('brain-file').click();
    document.getElementById('brain-file').onchange = importBrain;

    // PGN controls
    document.getElementById('export-pgn').onclick = exportPGN;
    document.getElementById('load-game').onclick = loadSelectedGame;
    document.getElementById('clear-history').onclick = clearHistory;

    // Training
    document.getElementById('btn-hyper-train').onclick = hyperTrain;
    const speedControl = document.getElementById('speed-control');
    if (speedControl) {
        speedControl.oninput = (e) => { speedMultiplier = parseFloat(e.target.value); };
    }
    document.getElementById('cancel-train').onclick = () => {
        isTraining = false;
        autoRunning = false;  // CRITICAL FIX: Also stop auto-running
        console.log('🛑 Training/Auto-play cancelled');
    };
}

function updateBrainStats() {
    const stats1 = ai1.brain.getStats();
    const stats2 = ai2.brain.getStats();
    const size1 = ai1.brain.getMemorySize();
    const size2 = ai2.brain.getMemorySize();

    brainStatsEl.innerHTML = `
        <div>
            <strong>${ai1.getStrategyName()} AI</strong><br>
            Positions: ${size1}<br>
            Record: ${stats1.wins}W-${stats1.losses}L-${stats1.draws}D<br>
            Games: ${stats1.games}
        </div>
        <div>
            <strong>${ai2.getStrategyName()} AI</strong><br>
            Positions: ${size2}<br>
            Record: ${stats2.wins}W-${stats2.losses}L-${stats2.draws}D<br>
            Games: ${stats2.games}
        </div>
    `;
}

function updateMoveList() {
    if (!moveListEl) return;
    const formatted = pgnManager.getFormattedMoves();
    moveListEl.textContent = formatted || 'No moves yet';
}

function updateOpponentName() {
    if (!opponentNameEl) return;

    if (currentMode === MODES.CVC) {
        // In AIvAI, show both AI names
        opponentNameEl.textContent = `${ai2.getStrategyName()} AI`;
        if (playerNameEl) playerNameEl.textContent = `${ai1.getStrategyName()} AI`;
    } else if (currentMode === MODES.HVC) {
        opponentNameEl.textContent = `${currentAI.getStrategyName()} AI`;
        if (playerNameEl) playerNameEl.textContent = 'You';
    } else {
        opponentNameEl.textContent = 'Opponent';
        if (playerNameEl) playerNameEl.textContent = 'You';
    }
}

// --- Rendering ---
function renderBoard() {
    if (isTraining) return;

    // Visual cue: highlight the king if the side to move is in check.
    let checkKingPos = null;
    try {
        if (Rules.isKingInCheck(game.board, game.turn)) {
            for (let rr = 0; rr < BOARD_SIZE; rr++) {
                for (let cc = 0; cc < BOARD_SIZE; cc++) {
                    const pp = game.board[rr][cc];
                    if (pp && pp.color === game.turn && pp.type === PIECES.KING) {
                        checkKingPos = { r: rr, c: cc };
                        break;
                    }
                }
                if (checkKingPos) break;
            }
        }
    } catch (_) {
        // If rules implementation changes, don't let rendering break.
        checkKingPos = null;
    }

    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const sq = document.createElement('div');
            sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            sq.onclick = () => handleSquareClick(r, c);

            if (c === 0) {
                const t = document.createElement('span');
                t.className = 'coord rank';
                t.innerText = 9 - r;
                sq.appendChild(t);
            }
            if (r === 8) {
                const t = document.createElement('span');
                t.className = 'coord file';
                t.innerText = FILES[c];
                sq.appendChild(t);
            }

            if (selectedSq && selectedSq.r === r && selectedSq.c === c) sq.classList.add('selected');
            const lastMove = game.moveHistory[game.moveHistory.length - 1];
            if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
                sq.classList.add('last-move');
            }
            if (checkKingPos && checkKingPos.r === r && checkKingPos.c === c) {
                sq.classList.add('in-check');
            }

            const isLegal = legalMoves.find(m => m.r === r && m.c === c);
            if (isLegal) {
                if (game.board[r][c]) sq.classList.add('capture-move');
                else sq.classList.add('legal-move');
            }

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

    const move = legalMoves.find(m => m.r === r && m.c === c);
    if (move) {
        executeAndRecordMove(selectedSq, move);
        selectedSq = null;
        legalMoves = [];
        renderBoard();
        updateStatus();
        updateMoveList();

        if (currentMode === MODES.HVC && !game.gameOver) {
            triggerAiMove();
        }
        return;
    }

    const p = game.board[r][c];
    if (p && p.color === game.turn) {
        selectedSq = { r, c };
        legalMoves = Rules.getLegalMoves(game.board, r, c);
        renderBoard();
    } else {
        selectedSq = null;
        legalMoves = [];
        renderBoard();
    }
}

function executeAndRecordMove(from, to) {
    const piece = game.board[from.r][from.c];
    const captured = game.board[to.r][to.c];

    // Keep a parallel UCI move list for engine sync.
    // Note: for promotions, JS game auto-promotes to queen; we encode that as "q".
    const uci = moveToUCI(from, to, piece);
    game.executeMove(from, to);
    if (uci) uciMoveHistory.push(uci);

    const isCheck = Rules.isKingInCheck(game.board, game.turn);
    const status = game.checkStatus();
    const isCheckmate = status.over && isCheck;

    pgnManager.recordMove(from, to, piece, captured, isCheck, isCheckmate);
}

function isAiTurn() {
    const aiColor = document.getElementById('computer-side').value === 'white' ? COLORS.WHITE : COLORS.BLACK;
    return game.turn === aiColor;
}

// --- AI Execution ---

// Parse UCI move format (e.g., "e2e4") to our move format
function parseUCIMove(uciMove) {
    console.log('🔧 Parsing UCI move:', uciMove);

    if (!uciMove || typeof uciMove !== 'string') {
        console.error('❌ Invalid UCI move (not a string):', uciMove);
        return null;
    }

    if (uciMove.length < 4) {
        console.error('❌ Invalid UCI move (too short):', uciMove);
        return null;
    }

    const files = 'abcdefghi';
    const fromFile = files.indexOf(uciMove[0]);
    const fromRank = 9 - parseInt(uciMove[1]);
    const toFile = files.indexOf(uciMove[2]);
    const toRank = 9 - parseInt(uciMove[3]);

    if (fromFile < 0) {
        console.error('❌ Invalid from file:', uciMove[0]);
        return null;
    }
    if (toFile < 0) {
        console.error('❌ Invalid to file:', uciMove[2]);
        return null;
    }
    if (isNaN(fromRank) || fromRank < 0 || fromRank >= 9) {
        console.error('❌ Invalid from rank:', uciMove[1], '-> rank:', fromRank);
        return null;
    }
    if (isNaN(toRank) || toRank < 0 || toRank >= 9) {
        console.error('❌ Invalid to rank:', uciMove[3], '-> rank:', toRank);
        return null;
    }

    const move = {
        from: { r: fromRank, c: fromFile },
        to: { r: toRank, c: toFile }
    };

    console.log('✅ Parsed successfully:', move);
    return move;
}

function moveToUCI(from, to, movedPiece) {
    const files = 'abcdefghi';
    const fromFile = files[from.c];
    const toFile = files[to.c];
    const fromRank = 9 - from.r;
    const toRank = 9 - to.r;

    if (!fromFile || !toFile || fromRank < 1 || fromRank > 9 || toRank < 1 || toRank > 9) return null;

    let promo = '';
    if (movedPiece && movedPiece.type === PIECES.PAWN && (to.r === 0 || to.r === 8)) {
        promo = 'q';
    }
    return `${fromFile}${fromRank}${toFile}${toRank}${promo}`;
}

// Get move from C engine or JS AI
async function getEngineMove() {
    const useCEngineCheckbox = document.getElementById('use-c-engine');
    const useCEngine = useCEngineCheckbox && useCEngineCheckbox.checked;

    // Check randomness setting
    const randomnessCheckbox = document.getElementById('add-randomness');
    const randomnessLevel = (randomnessCheckbox && randomnessCheckbox.checked) ? 50 : 0; // 50 centipawns noise

    console.log('🔍 getEngineMove called');
    console.log('  - Use C Engine:', useCEngine);
    console.log('  - Randomness:', randomnessLevel);
    console.log('  - Current turn:', game.turn);

    if (useCEngine) {
        // Use C Engine via backend
        try {
            console.log('📡 Calling C Engine API...');
            const startTime = performance.now();

            const response = await BackendAPI.getEngineMove(uciMoveHistory, 5, randomnessLevel, null); // startpos moves ..., depth 5

            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`📨 Engine response received in ${elapsed}s:`, response);

            if (response.success && response.move) {
                console.log('✅ Valid engine response, parsing move:', response.move);
                const parsedMove = parseUCIMove(response.move);

                if (parsedMove) {
                    console.log('✅ Parsed move successfully:', parsedMove);
                    return parsedMove;
                } else {
                    console.error('❌ parseUCIMove returned null for:', response.move);
                }
            } else {
                console.warn('⚠️ Engine error or no move:', response.error || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Engine request failed:', error);
        }

        console.log('⤵️ Falling back to JS AI');
    }

    // Use JavaScript AI (fallback or if checkbox unchecked)
    console.log('🤖 Using JavaScript AI');
    let aiToUse;
    if (currentMode === MODES.CVC) {
        aiToUse = game.turn === COLORS.WHITE ? ai1 : ai2;
        console.log('  - AI:', game.turn === COLORS.WHITE ? 'ai1 (White)' : 'ai2 (Black)');
    } else {
        aiToUse = currentAI;
        console.log('  - AI: currentAI');
    }

    const move = await aiToUse.getBestMove(game, game.turn);
    console.log('🎯 JS AI returned move:', move);
    return move;
}

async function triggerAiMove() {
    // CRITICAL FIX: Check if we should even run
    if (game.gameOver || !autoRunning) return;

    thinkEl.innerText = 'Thinking...';
    await new Promise(r => setTimeout(r, 50));

    const moveStartTime = performance.now();
    const move = await getEngineMove();
    const moveEndTime = performance.now();

    thinkEl.innerText = '';

    if (move) {
        // Calculate and display move time
        const moveTimeSeconds = ((moveEndTime - moveStartTime) / 1000).toFixed(2);
        updateMoveTime(game.turn, moveTimeSeconds);

        executeAndRecordMove(move.from, move.to);
        renderBoard();
        updateStatus();
        updateMoveList();

        const status = game.checkStatus();
        if (status.over) {
            handleGameEnd(status);
        } else if (currentMode === MODES.CVC) {
            // CRITICAL FIX: Always continue in AI vs AI, autoRunning checked at top
            setTimeout(triggerAiMove, 500);
        }
    }
}

// Update move time display
function updateMoveTime(color, timeSeconds) {
    const timeEl = color === COLORS.WHITE ?
        document.getElementById('player-time') :
        document.getElementById('opponent-time');

    if (timeEl) {
        timeEl.textContent = `${timeSeconds}s`;
    }
}

function handleGameEnd(status) {
    game.gameOver = true;
    autoRunning = false;
    document.getElementById('start-auto').disabled = false;
    document.getElementById('stop-auto').disabled = true;

    let pgnResult;
    if (status.winner === COLORS.WHITE) {
        pgnResult = '1-0';
        if (currentMode === MODES.CVC) {
            ai1.brain.finalizeGame('win');
            ai2.brain.finalizeGame('loss');
        } else {
            currentAI.brain.finalizeGame(isAiTurn() ? 'loss' : 'win');
        }
    } else if (status.winner === COLORS.BLACK) {
        pgnResult = '0-1';
        if (currentMode === MODES.CVC) {
            ai1.brain.finalizeGame('loss');
            ai2.brain.finalizeGame('win');
        } else {
            currentAI.brain.finalizeGame(isAiTurn() ? 'loss' : 'win');
        }
    } else {
        pgnResult = '1/2-1/2';
        if (currentMode === MODES.CVC) {
            ai1.brain.finalizeGame('draw');
            ai2.brain.finalizeGame('draw');
        } else {
            currentAI.brain.finalizeGame('draw');
        }
    }

    pgnManager.endGame(pgnResult);
    updateBrainStats();
    updateGameHistory();

    // Persist completed games to backend (optional; frontend also stores local history).
    // Non-blocking: don't prevent UI updates if backend is offline.
    try {
        const pgn = pgnManager.exportPGN(pgnManager.getGame(0));
        BackendAPI.saveGame({
            pgn,
            white: pgnManager.getGame(0)?.white,
            black: pgnManager.getGame(0)?.black,
            result: pgnResult,
            moves: pgnManager.getGame(0)?.moves || []
        });
        BackendAPI.analyzeGame({
            white: pgnManager.getGame(0)?.white,
            black: pgnManager.getGame(0)?.black,
            result: pgnResult,
            moves: pgnManager.getGame(0)?.moves || []
        });
    } catch (_) {
        // Ignore persistence failures
    }
}

// --- Game Control ---
function updateStatus() {
    const status = game.checkStatus();
    if (status.over) {
        statusEl.innerText = status.msg;
    } else {
        statusEl.innerText = status.msg;
    }

    const score = game.getScore();
    const txt = score === 0 ? "Equal" : (score > 0 ? `White +${score}` : `Black +${Math.abs(score)}`);
    scoreEl.innerText = `Material: ${txt}`;
}

function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');

    autoRunning = false;
    resetGame();

    // CRITICAL FIX: Hide/show AI controls based on mode
    const startAutoBtn = document.getElementById('start-auto');
    const stopAutoBtn = document.getElementById('stop-auto');

    if (mode === MODES.HVH) {
        // Player vs Player: Hide AI controls completely
        startAutoBtn.style.display = 'none';
        stopAutoBtn.style.display = 'none';
    } else {
        // AI modes: Show controls
        startAutoBtn.style.display = '';
        stopAutoBtn.style.display = '';
        startAutoBtn.disabled = false;
        stopAutoBtn.disabled = true;
    }

    updateOpponentName();
}

function resetGame() {
    autoRunning = false;
    game = new Game();
    uciMoveHistory = [];
    selectedSq = null;
    legalMoves = [];

    const whiteName = currentMode === MODES.CVC ? ai1.getStrategyName() + ' AI' : 'White';
    const blackName = currentMode === MODES.CVC ? ai2.getStrategyName() + ' AI' :
        currentMode === MODES.HVC ? currentAI.getStrategyName() + ' AI' : 'Black';

    pgnManager.startNewGame(whiteName, blackName, currentMode);

    renderBoard();
    updateStatus();
    updateMoveList();
}

function handleUndo() {
    if (autoRunning || isTraining) return;
    // Allow undo even after game end (useful for analysis/review).
    // If undo succeeds we resume a non-terminal state.

    if (currentMode === MODES.HVH) {
        if (game.undoLastMove()) {
            uciMoveHistory.pop();
            selectedSq = null;
            legalMoves = [];
            game.gameOver = false;
            renderBoard();
            updateStatus();
            updateMoveList();
        }
    } else if (currentMode === MODES.HVC) {
        if (!isAiTurn()) {
            game.undoLastMove();
            game.undoLastMove();
            uciMoveHistory.pop();
            uciMoveHistory.pop();
            selectedSq = null;
            legalMoves = [];
            game.gameOver = false;
            renderBoard();
            updateStatus();
            updateMoveList();
        }
    }
}

function handleLevelChange(e) {
    const level = parseInt(e.target.value);
    document.getElementById('ai-level-label').innerText = level;
    currentAI.setLevel(level);
    ai1.setLevel(level);
    ai2.setLevel(level);
}

function handleStrategyChange(e) {
    const strategy = e.target.value;
    currentAI.setStrategy(strategy);
    updateOpponentName();
}

function handleSideChange() {
    if (currentMode === MODES.HVC && isAiTurn() && !game.gameOver) {
        triggerAiMove();
    }
}

function startAuto() {
    autoRunning = true;
    document.getElementById('start-auto').disabled = true;
    document.getElementById('stop-auto').disabled = false;
    triggerAiMove();
}

function stopAuto() {
    autoRunning = false;
    document.getElementById('start-auto').disabled = false;
    document.getElementById('stop-auto').disabled = true;
}

// --- Brain Management ---
function resetBrain() {
    if (confirm('Reset all AI brain memory? This cannot be undone.')) {
        ai1.brain.clear();
        ai2.brain.clear();
        currentAI.brain.clear();
        updateBrainStats();
    }
}

function exportBrain() {
    const data1 = ai1.brain.exportToJSON();
    const data2 = ai2.brain.exportToJSON();
    const combined = { ai1: data1, ai2: data2 };

    const blob = new Blob([JSON.stringify(combined, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shatrunz_brains_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importBrain(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.ai1) ai1.brain.importFromJSON(data.ai1);
            if (data.ai2) ai2.brain.importFromJSON(data.ai2);
            updateBrainStats();
            alert('Brain data imported successfully!');
        } catch (e) {
            alert('Failed to import brain data: ' + e.message);
        }
    };
    reader.readAsText(file);
}

// --- PGN Management ---
function exportPGN() {
    pgnManager.exportCurrentGame();
}

function updateGameHistory() {
    const select = document.getElementById('game-history');
    if (!select) return;

    select.innerHTML = '';
    const history = pgnManager.getGameHistory();

    history.forEach((game, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${game.date} - ${game.white} vs ${game.black} (${game.result})`;
        select.appendChild(option);
    });
}

function loadSelectedGame() {
    const select = document.getElementById('game-history');
    if (!select || select.value === '') return;

    const gameData = pgnManager.getGame(parseInt(select.value));
    if (gameData) {
        alert('Game loaded:\n' + pgnManager.exportPGN(gameData));
    }
}

function clearHistory() {
    if (confirm('Clear all game history?')) {
        pgnManager.clearHistory();
        updateGameHistory();
    }
}

// --- Hyper Training ---
async function hyperTrain() {
    if (isTraining) return;
    isTraining = true;
    autoRunning = false;

    const overlay = document.getElementById('training-overlay');
    const bar = document.getElementById('train-progress');
    const status = document.getElementById('train-status');
    overlay.style.display = 'flex';

    const GAMES_TO_TRAIN = 50;
    const oldLevel = ai1.level;
    ai1.setLevel(2);
    ai2.setLevel(2);

    for (let i = 1; i <= GAMES_TO_TRAIN && isTraining; i++) {
        game = new Game();
        pgnManager.startNewGame(ai1.getStrategyName(), ai2.getStrategyName(), 'training');
        let moves = 0;

        status.innerText = `Game ${i}/${GAMES_TO_TRAIN}`;
        bar.style.width = `${(i / GAMES_TO_TRAIN) * 100}%`;

        while (!game.gameOver && moves < 150) {
            const aiToUse = game.turn === COLORS.WHITE ? ai1 : ai2;
            const m = await aiToUse.getBestMove(game, game.turn, true);

            if (m) {
                executeAndRecordMove(m.from, m.to);
                const st = game.checkStatus();
                if (st.over) {
                    handleGameEnd(st);
                }
            } else break;

            moves++;
            if (moves % 20 === 0) await new Promise(r => setTimeout(r, 0));
        }
    }

    isTraining = false;
    overlay.style.display = 'none';
    ai1.setLevel(oldLevel);
    ai2.setLevel(oldLevel);
    updateBrainStats();
    updateGameHistory();
    resetGame();
}

// Initialize on load
updateGameHistory();
