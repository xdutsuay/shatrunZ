import { COLORS } from './constants.js';
import { Rules } from './rules.js';
import { AIPlayer } from './ai.js';
import { PGNManager } from './pgn.js';
import { MODES, isAiTurn as isAiTurnFor } from './mode_logic.js';
import { GameSession } from './shared/game_session.js';
import { BoardView } from './shared/board_view.js';
import { brainNameFor } from './shared/brain_utils.js';
import { replayGameFromUci } from './shared/replay.js';
import { ReplayStepController } from './shared/replay_step.js';
import { explainMove } from './shared/move_explainer.js';
import { loadPolicyMetrics, formatMetricsPanel } from './shared/policy_net.js';
import { setHelpStatusText } from './shared/help_signal.js';
import { ClockController, formatClock } from './shared/clock_controller.js';
import { SettingsKeys, getSettings, setBool } from './shared/settings_store.js';
import { PvpModeController } from './modes/pvp.js';
import { PvaiModeController } from './modes/pvai.js';
import { AivaiModeController, strategyFromSelect } from './modes/aivai.js';

const EXPLAIN_KEY = 'shatrunz_enable_move_explain';
const POLICY_KEY = 'shatrunz_use_policy_net';

let currentMode = MODES.HVH;
let modeController;

let ai1 = new AIPlayer(3, 'material', 'material_ai');
let ai2 = new AIPlayer(3, 'positional', 'positional_ai');
let currentAI = ai1;

let pgnManager = new PGNManager();
let isTraining = false;
let selectedSq = null;
let legalMoves = [];
let replayController = null;
let reviewState = null;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('scoreboard');
const brainStatsEl = document.getElementById('brain-stats');
const thinkEl = document.getElementById('thinking-indicator');
const moveListEl = document.getElementById('move-list');
const opponentNameEl = document.getElementById('opponent-name');
const playerNameEl = document.getElementById('player-name');
const moveExplainEl = document.getElementById('move-explanation');

const clock = new ClockController();

function computerSideValue() {
    return document.getElementById('computer-side')?.value || 'black';
}

function isAiTurn() {
    return isAiTurnFor({ turn: getGame().turn, computerSideValue: computerSideValue() });
}

function getGame() {
    return session.game;
}

function isClockEnabled() {
    return getSettings().enableClocks;
}

function getClockSettings() {
    const s = getSettings();
    return { totalMs: s.clockTotalMs, incrementMs: s.clockIncrementMs };
}

function bottomColor() {
    if (currentMode === MODES.HVC) {
        return computerSideValue() === 'white' ? COLORS.BLACK : COLORS.WHITE;
    }
    return COLORS.WHITE;
}

function renderClocks({ whiteMs, blackMs }) {
    const playerEl = document.getElementById('player-time');
    const oppEl = document.getElementById('opponent-time');
    if (!playerEl || !oppEl) return;
    if (!isClockEnabled()) return;
    const bottom = bottomColor();
    const bottomMs = bottom === COLORS.WHITE ? whiteMs : blackMs;
    const topMs = bottom === COLORS.WHITE ? blackMs : whiteMs;
    playerEl.textContent = formatClock(bottomMs);
    oppEl.textContent = formatClock(topMs);
}

let session = new GameSession({
    pgnManager,
    getMode: () => currentMode,
    getAiState: () => ({ ai1, ai2, currentAI }),
    isAiTurnFn: isAiTurn,
});

session.onAfterMove = ({ sideMoved, nextTurn }) => {
    if (!isClockEnabled()) return;
    clock.onMoveMade(sideMoved, nextTurn);
    clock.setTurn(nextTurn);
};

const ctx = {
    get game() { return session.game; },
    ai1,
    ai2,
    currentAI,
    pgnManager,
    session,
    get isTraining() { return isTraining; },
    get isReviewing() { return reviewState != null; },
    statusEl,
    thinkEl,
    Rules,
    getSelection: () => ({ selectedSq, legalMoves }),
    setSelection: (sq, moves) => {
        selectedSq = sq;
        legalMoves = moves;
    },
    clearSelection: () => {
        selectedSq = null;
        legalMoves = [];
    },
    boardView: null,
    refreshUi: () => {
        updateStatus();
        updateMoveList();
        updateBrainStats();
        updateLiveNavControls();
        syncHelpButton();
    },
    updateOpponentName,
    updateModePanels,
    rebuildAivaiPlayers,
    rebuildPvaiPlayer,
    rebuildTrainingPlayers,
    syncAutoButtons,
    syncHelpButton,
    onGameEnd: handleGameEnd,
    updateMoveTime,
    maybeExplainMove,
};

const boardView = new BoardView({
    boardEl,
    getGame,
    getSelection: () => ({ selectedSq, legalMoves }),
    onSquareClick: (r, c) => {
        if (reviewState) return;
        if (modeController.onSquareClick(r, c)) return;
        if (modeController.shouldBlockInput()) return;

        const game = getGame();
        const move = legalMoves.find(m => m.r === r && m.c === c);
        if (move && selectedSq) {
            session.executeAndRecordMove(selectedSq, move);
            clearSelectionLocal();
            boardView.render();
            refreshUiLocal();
            return;
        }

        const p = game.board[r][c];
        if (p && p.color === game.turn) {
            selectedSq = { r, c };
            legalMoves = Rules.getLegalMoves(game.board, r, c);
            boardView.render();
        } else {
            clearSelectionLocal();
            boardView.render();
        }
    },
    isTraining: () => isTraining,
});

ctx.boardView = boardView;

function clearSelectionLocal() {
    selectedSq = null;
    legalMoves = [];
}

function refreshUiLocal() {
    updateStatus();
    updateMoveList();
    updateBrainStats();
    updateLiveNavControls();
    syncHelpButton();
    if (isClockEnabled()) {
        const paused = isTraining || reviewState != null || getGame().gameOver || modeController?.helpMode;
        clock.setPaused(paused);
        clock.setTurn(getGame().turn);
    }
}

Object.assign(ctx, {
    clearSelection: clearSelectionLocal,
    refreshUi: refreshUiLocal,
});

modeController = new PvpModeController(ctx);
modeController.ctx = ctx;

function aiLevel() {
    return parseInt(document.getElementById('ai-level')?.value || '3', 10);
}

function rebuildAivaiPlayers() {
    const level = aiLevel();
    const s1 = strategyFromSelect('white');
    const s2 = strategyFromSelect('black');
    ai1 = new AIPlayer(level, s1, brainNameFor({ mode: 'cvc', role: 'white', strategy: s1 }));
    ai2 = new AIPlayer(level, s2, brainNameFor({ mode: 'cvc', role: 'black', strategy: s2 }));
    currentAI = ai1;
    syncAiRefs();
}

function rebuildPvaiPlayer() {
    const level = aiLevel();
    const strategy = (document.getElementById('ai-strategy')?.value || 'material').toLowerCase();
    currentAI = new AIPlayer(level, strategy, brainNameFor({ mode: 'hvc', role: 'solo', strategy }));
    rebuildTrainingPlayers();
    syncAiRefs();
}

function rebuildTrainingPlayers() {
    const level = aiLevel();
    ai1 = new AIPlayer(level, 'material', brainNameFor({ mode: 'training', role: 'white', strategy: 'material' }));
    ai2 = new AIPlayer(level, 'positional', brainNameFor({ mode: 'training', role: 'black', strategy: 'positional' }));
    syncAiRefs();
}

function syncAiRefs() {
    ctx.ai1 = ai1;
    ctx.ai2 = ai2;
    ctx.currentAI = currentAI;
}

ctx.rebuildAivaiPlayers = rebuildAivaiPlayers;
ctx.rebuildPvaiPlayer = rebuildPvaiPlayer;
ctx.rebuildTrainingPlayers = rebuildTrainingPlayers;

function updateModePanels() {
    const pvaiOnly = document.getElementById('pvai-only-controls');
    const aivaiOnly = document.getElementById('aivai-only-controls');
    const playAs = document.getElementById('play-as-group');
    if (pvaiOnly) pvaiOnly.style.display = currentMode === MODES.HVC ? '' : 'none';
    if (aivaiOnly) aivaiOnly.style.display = currentMode === MODES.CVC ? '' : 'none';
    if (playAs) playAs.style.display = currentMode === MODES.HVC ? '' : 'none';
}

function isHelpEnabled() {
    const el = document.getElementById('enable-ai-help');
    if (el) return el.checked;
    return getSettings().enableHelp;
}

function isExplainEnabled() {
    const el = document.getElementById('enable-move-explain');
    if (el) return el.checked;
    return localStorage.getItem(EXPLAIN_KEY) === '1';
}

function syncHelpButton() {
    const btn = document.getElementById('btn-help-ai');
    if (!btn) return;
    const enabled = isHelpEnabled();
    const aiMode = currentMode === MODES.HVC || currentMode === MODES.CVC;
    btn.style.display = enabled && aiMode ? '' : 'none';
    btn.disabled = !aiMode || getGame().gameOver;
}

function syncAutoButtons() {
    const mc = modeController;
    const startAutoBtn = document.getElementById('start-auto');
    const stopAutoBtn = document.getElementById('stop-auto');
    if (!startAutoBtn || !stopAutoBtn) return;

    if (currentMode === MODES.HVH) {
        startAutoBtn.style.display = 'none';
        stopAutoBtn.style.display = 'none';
        return;
    }

    startAutoBtn.style.display = '';
    stopAutoBtn.style.display = '';
    startAutoBtn.disabled = mc.autoRunning;
    stopAutoBtn.disabled = !mc.autoRunning;
}

ctx.syncAutoButtons = syncAutoButtons;
ctx.syncHelpButton = syncHelpButton;
ctx.updateModePanels = updateModePanels;

async function refreshMlMetrics() {
    const el = document.getElementById('ml-metrics-panel');
    if (!el) return;
    const metrics = await loadPolicyMetrics();
    el.textContent = formatMetricsPanel(metrics);
}

export function initUI(initialMode = MODES.HVH) {
    const helpEl = document.getElementById('enable-ai-help');
    if (helpEl) helpEl.checked = getSettings().enableHelp;
    const autoHelpEl = document.getElementById('enable-ai-auto-help');
    if (autoHelpEl) autoHelpEl.checked = getSettings().autoHelp;
    const sig = (id, key, def = true) => {
        const el = document.getElementById(id);
        if (!el) return;
        const v = localStorage.getItem(key);
        el.checked = v === null ? def : v === '1';
    };
    sig('help-signal-eval', 'shatrunz_help_eval_swing');
    sig('help-signal-margin', 'shatrunz_help_low_margin');
    sig('help-signal-unknown', 'shatrunz_help_unknown');
    sig('help-signal-repeat', 'shatrunz_help_repeat');
    const explainEl = document.getElementById('enable-move-explain');
    if (explainEl) explainEl.checked = localStorage.getItem(EXPLAIN_KEY) === '1';
    const policyEl = document.getElementById('use-policy-net');
    if (policyEl) policyEl.checked = localStorage.getItem(POLICY_KEY) === '1';

    setupEventListeners();
    highlightModeNav(initialMode);
    setMode(initialMode);
    updateGameHistory();
    updateLiveNavControls();
    refreshMlMetrics();

    clock.onTick = renderClocks;
    clock.onFlagFall = (fell) => {
        modeController.stopAuto();
        session.game.gameOver = true;
        statusEl.innerText = `${fell === COLORS.WHITE ? 'White' : 'Black'} ran out of time.`;
    };
}

function setModeControllers(mode) {
    modeController.onLeave();
    if (mode === MODES.HVH) modeController = new PvpModeController(ctx);
    else if (mode === MODES.HVC) modeController = new PvaiModeController(ctx);
    else modeController = new AivaiModeController(ctx);
    modeController.ctx = ctx;
}

function highlightModeNav(mode) {
    document.querySelectorAll('.mode-nav-link[data-mode]').forEach((link) => {
        link.classList.toggle('active', link.dataset.mode === mode);
    });
}

function setupEventListeners() {
    document.getElementById('btn-undo').onclick = () => modeController.onUndo();
    document.getElementById('reset-game').onclick = resetGame;

    document.getElementById('ai-level').oninput = handleLevelChange;
    document.getElementById('ai-strategy').onchange = () => {
        if (currentMode === MODES.HVC) {
            rebuildPvaiPlayer();
            updateOpponentName();
            refreshUiLocal();
        }
    };
    document.getElementById('white-ai-strategy')?.addEventListener('change', onAivaiStrategyChange);
    document.getElementById('black-ai-strategy')?.addEventListener('change', onAivaiStrategyChange);
    document.getElementById('computer-side').onchange = () => {
        if (modeController.autoRunning && !getGame().gameOver && currentMode === MODES.HVC) {
            modeController.triggerAiMove();
        }
    };

    document.getElementById('start-auto').onclick = () => modeController.startAuto();
    document.getElementById('stop-auto').onclick = () => modeController.stopAuto();
    document.getElementById('btn-help-ai').onclick = () => {
        if (modeController.helpMode) {
            modeController.helpMode = false;
            modeController.resumeAfterHelp();
        } else {
            modeController.pauseForHelp('');
            setHelpStatusText(statusEl, getGame().turn, '');
        }
    };

    document.getElementById('enable-ai-help')?.addEventListener('change', (e) => {
        setBool(SettingsKeys.enableHelp, e.target.checked);
        syncHelpButton();
    });
    document.getElementById('enable-ai-auto-help')?.addEventListener('change', (e) => {
        setBool(SettingsKeys.autoHelp, e.target.checked);
    });
    document.getElementById('use-policy-net')?.addEventListener('change', (e) => {
        localStorage.setItem(POLICY_KEY, e.target.checked ? '1' : '0');
    });
    const bindHelpSignal = (id, key) => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            localStorage.setItem(key, e.target.checked ? '1' : '0');
        });
    };
    bindHelpSignal('help-signal-eval', 'shatrunz_help_eval_swing');
    bindHelpSignal('help-signal-margin', 'shatrunz_help_low_margin');
    bindHelpSignal('help-signal-unknown', 'shatrunz_help_unknown');
    bindHelpSignal('help-signal-repeat', 'shatrunz_help_repeat');
    document.getElementById('enable-move-explain')?.addEventListener('change', (e) => {
        localStorage.setItem(EXPLAIN_KEY, e.target.checked ? '1' : '0');
        if (!e.target.checked && moveExplainEl) moveExplainEl.textContent = '';
    });

    document.getElementById('reset-brain').onclick = resetBrain;
    document.getElementById('export-brain').onclick = exportBrain;
    document.getElementById('import-brain').onclick = () => document.getElementById('brain-file').click();
    document.getElementById('brain-file').onchange = importBrain;

    document.getElementById('export-pgn').onclick = () => pgnManager.exportCurrentGame();
    document.getElementById('load-game').onclick = loadSelectedGame;
    document.getElementById('clear-history').onclick = clearHistory;
    document.getElementById('import-pgn')?.addEventListener('click', () => {
        document.getElementById('pgn-file')?.click();
    });
    document.getElementById('pgn-file')?.addEventListener('change', importPgnFile);
    document.getElementById('replay-start')?.addEventListener('click', () => replayStepTo(0));
    document.getElementById('replay-back')?.addEventListener('click', () => replayStepBack());
    document.getElementById('replay-forward')?.addEventListener('click', () => replayStepForward());
    document.getElementById('replay-end')?.addEventListener('click', () => {
        if (replayController) replayStepTo(replayController.maxPly);
    });

    document.getElementById('btn-hyper-train').onclick = hyperTrain;
    document.getElementById('cancel-train').onclick = () => {
        isTraining = false;
        modeController.stopAuto();
        const overlay = document.getElementById('training-overlay');
        if (overlay) overlay.style.display = 'none';
        boardView.render();
        refreshUiLocal();
    };

    document.getElementById('nav-start')?.addEventListener('click', () => liveNavTo(0));
    document.getElementById('nav-back')?.addEventListener('click', () => liveNavTo(currentNavPly() - 1));
    document.getElementById('nav-forward')?.addEventListener('click', () => liveNavTo(currentNavPly() + 1));
    document.getElementById('nav-end')?.addEventListener('click', () => liveNavTo(tipNavPly()));
}

function onAivaiStrategyChange() {
    if (currentMode !== MODES.CVC) return;

    const allowMidgame = getSettings().allowMidgamePersonaChange;
    const inProgress = !replayController && session.uciMoveHistory.length > 0 && !getGame().gameOver;
    if (!allowMidgame && inProgress) {
        const w = document.getElementById('white-ai-strategy');
        const b = document.getElementById('black-ai-strategy');
        if (w) w.value = ai1.getStrategyName().toLowerCase();
        if (b) b.value = ai2.getStrategyName().toLowerCase();
        return;
    }

    rebuildAivaiPlayers();
    updateOpponentName();
    refreshUiLocal();
}

function updateBrainStats() {
    if (!brainStatsEl) return;
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
        <motionless></motionless>
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
    const moves = pgnManager.getFormattedMoves() || 'No moves yet';
    const help = pgnManager.getHelpSummary();
    moveListEl.textContent = help ? `${moves}\n\n— ${help}` : moves;
}

function tipNavPly() {
    return reviewState ? reviewState.liveUci.length : session.uciMoveHistory.length;
}

function currentNavPly() {
    return reviewState ? reviewState.controller.ply : session.uciMoveHistory.length;
}

function updateLiveNavControls() {
    const label = document.getElementById('nav-ply-label');
    const startBtn = document.getElementById('nav-start');
    const backBtn = document.getElementById('nav-back');
    const fwdBtn = document.getElementById('nav-forward');
    const endBtn = document.getElementById('nav-end');

    const cur = currentNavPly();
    const tip = tipNavPly();

    if (label) label.textContent = `${cur} / ${tip}`;
    if (startBtn) startBtn.disabled = cur <= 0;
    if (backBtn) backBtn.disabled = cur <= 0;
    if (fwdBtn) fwdBtn.disabled = cur >= tip;
    if (endBtn) endBtn.disabled = cur >= tip;
}

function enterReview(ply) {
    const liveUci = [...session.uciMoveHistory];
    reviewState = {
        liveGame: session.game,
        liveUci,
        controller: new ReplayStepController(liveUci),
    };
    reviewState.controller.stepTo(ply);
    session.game = reviewState.controller.game;
    session.uciMoveHistory = reviewState.controller.uciHistory;
}

function applyReviewFrame() {
    if (!reviewState) return;
    session.game = reviewState.controller.game;
    session.uciMoveHistory = reviewState.controller.uciHistory;
    session.game.gameOver = reviewState.controller.ply >= reviewState.controller.maxPly;
    clearSelectionLocal();
    boardView.render();
    refreshUiLocal();
    updateLiveNavControls();
    statusEl.innerText = `Review: ${reviewState.controller.ply} / ${reviewState.controller.maxPly}`;
}

function exitReview() {
    if (!reviewState) return;
    session.game = reviewState.liveGame;
    session.uciMoveHistory = [...reviewState.liveUci];
    reviewState = null;
    boardView.render();
    refreshUiLocal();
    updateLiveNavControls();
}

function liveNavTo(targetPly) {
    const tip = tipNavPly();
    const ply = Math.max(0, Math.min(targetPly, tip));
    modeController.stopAuto();
    if (ply === tip) {
        exitReview();
        return;
    }
    if (!reviewState) {
        enterReview(ply);
    } else {
        reviewState.controller.stepTo(ply);
    }
    applyReviewFrame();
}

function updateOpponentName() {
    if (!opponentNameEl) return;
    if (currentMode === MODES.CVC) {
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

ctx.updateOpponentName = updateOpponentName;

function updateMoveTime(color, timeSeconds) {
    const timeEl = color === COLORS.WHITE
        ? document.getElementById('player-time')
        : document.getElementById('opponent-time');
    if (!isClockEnabled() && timeEl) timeEl.textContent = `${timeSeconds}s`;
}

ctx.updateMoveTime = updateMoveTime;

function maybeExplainMove(move, record, ai) {
    if (!isExplainEnabled() || !moveExplainEl) return;
    const persona = ai.getStrategyName().toLowerCase();
    const text = explainMove({
        move,
        persona,
        captured: record.captured,
        isCheck: record.isCheck,
        isCheckmate: record.isCheckmate,
    });
    setTimeout(() => {
        moveExplainEl.textContent = text;
    }, 0);
}

ctx.maybeExplainMove = maybeExplainMove;

async function handleGameEnd(status) {
    modeController.stopAuto();
    clock.setPaused(true);
    await session.handleGameEnd(status, {
        onAfterEnd: () => {
            refreshUiLocal();
            updateGameHistory();
        },
    });
}

function updateStatus() {
    const game = getGame();
    const status = game.checkStatus();
    statusEl.innerText = status.msg;
    const score = game.getScore();
    const txt = score === 0 ? 'Equal' : (score > 0 ? `White +${score}` : `Black +${Math.abs(score)}`);
    scoreEl.innerText = `Material: ${txt}`;
}

function setMode(mode) {
    currentMode = mode;
    highlightModeNav(mode);

    setModeControllers(mode);
    resetGame();
    modeController.onEnter();
    syncAutoButtons();
    syncHelpButton();
}

function resetGame() {
    exitReplay();
    exitReview();
    modeController.stopAuto();
    clock.stop();
    session.abandonBrains();
    session.reset();
    clearSelectionLocal();

    if (currentMode === MODES.CVC) rebuildAivaiPlayers();
    else if (currentMode === MODES.HVC) rebuildPvaiPlayer();
    else rebuildTrainingPlayers();

    const whiteName = currentMode === MODES.CVC ? `${ai1.getStrategyName()} AI` : 'White';
    const blackName = currentMode === MODES.CVC ? `${ai2.getStrategyName()} AI`
        : currentMode === MODES.HVC ? `${currentAI.getStrategyName()} AI` : 'Black';

    pgnManager.startNewGame(whiteName, blackName, currentMode);
    boardView.render();
    refreshUiLocal();
    updateLiveNavControls();
    if (isClockEnabled()) {
        const { totalMs, incrementMs } = getClockSettings();
        clock.reset({ totalMs, incrementMs, turn: session.game.turn });
        clock.setPaused(false);
    }
    if (moveExplainEl) moveExplainEl.textContent = '';
}

function handleLevelChange(e) {
    const level = parseInt(e.target.value, 10);

    const allowMidgame = getSettings().allowMidgamePersonaChange;
    const inProgress = currentMode === MODES.CVC && !replayController && session.uciMoveHistory.length > 0 && !getGame().gameOver;
    if (!allowMidgame && inProgress) {
        e.target.value = String(ai1.level);
        document.getElementById('ai-level-label').innerText = ai1.level;
        return;
    }

    document.getElementById('ai-level-label').innerText = level;
    if (currentMode === MODES.CVC) rebuildAivaiPlayers();
    else if (currentMode === MODES.HVC) rebuildPvaiPlayer();
    else rebuildTrainingPlayers();
    refreshUiLocal();
}

function resetBrain() {
    if (confirm('Reset all AI brain memory? This cannot be undone.')) {
        ai1.brain.clear();
        ai2.brain.clear();
        currentAI.brain.clear();
        refreshUiLocal();
    }
}

function exportBrain() {
    const combined = { ai1: ai1.brain.exportToJSON(), ai2: ai2.brain.exportToJSON() };
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
            refreshUiLocal();
            alert('Brain data imported successfully!');
        } catch (err) {
            alert('Failed to import brain data: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function updateGameHistory() {
    const select = document.getElementById('game-history');
    if (!select) return;
    select.innerHTML = '';
    pgnManager.getGameHistory().forEach((g, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${g.date} - ${g.white} vs ${g.black} (${g.result})`;
        select.appendChild(option);
    });
}

function loadSelectedGame() {
    const select = document.getElementById('game-history');
    if (!select || select.value === '') return;

    const gameData = pgnManager.getGame(parseInt(select.value, 10));
    if (!gameData) return;

    const uci = gameData.uci_moves;
    if (!uci || uci.length === 0) {
        alert('Replay unavailable (no UCI moves saved).\n\n' + pgnManager.exportPGN(gameData));
        return;
    }

    startReplay(uci, gameData);
}

function startReplay(uciMoves, meta = {}) {
    modeController.stopAuto();
    exitReview();
    replayController = new ReplayStepController(uciMoves);
    applyReplayFrame(meta);
}

function applyReplayFrame(meta = {}) {
    if (!replayController) return;
    session.game = replayController.game;
    session.uciMoveHistory = replayController.uciHistory;
    session.game.gameOver = replayController.ply >= replayController.maxPly;
    clearSelectionLocal();
    boardView.render();
    refreshUiLocal();
    const label = document.getElementById('replay-ply-label');
    const controls = document.getElementById('replay-controls');
    if (label) label.textContent = `${replayController.ply} / ${replayController.maxPly}`;
    if (controls) controls.style.display = 'flex';
    const title = meta.white && meta.black
        ? `Replay: ${meta.white} vs ${meta.black} (${meta.result || '*'})`
        : 'Replay mode';
    statusEl.innerText = title;
    updateLiveNavControls();
}

function exitReplay() {
    replayController = null;
    const controls = document.getElementById('replay-controls');
    if (controls) controls.style.display = 'none';
    updateLiveNavControls();
}

function replayStepTo(ply) {
    if (!replayController) return;
    replayController.stepTo(ply);
    applyReplayFrame();
}

function replayStepForward() {
    if (!replayController) return;
    replayController.stepForward();
    applyReplayFrame();
}

function replayStepBack() {
    if (!replayController) return;
    replayController.stepBack();
    applyReplayFrame();
}

function importPgnFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const result = pgnManager.importPgnFile(reader.result);
        if (!result.ok) {
            alert('Import failed: ' + (result.error || 'unknown'));
            return;
        }
        updateGameHistory();
        alert('PGN imported. Select it in Game History and Load / Replay.');
        e.target.value = '';
    };
    reader.readAsText(file);
}

function clearHistory() {
    if (confirm('Clear all game history?')) {
        pgnManager.clearHistory();
        updateGameHistory();
    }
}

function endHyperTrainSession({ overlay, oldLevel }) {
    isTraining = false;
    if (overlay) overlay.style.display = 'none';
    if (oldLevel != null) {
        ai1.setLevel(oldLevel);
        ai2.setLevel(oldLevel);
    }
    if (currentMode === MODES.CVC) rebuildAivaiPlayers();
    else if (currentMode === MODES.HVC) rebuildPvaiPlayer();
    else rebuildTrainingPlayers();
    boardView.render();
    refreshUiLocal();
}

async function hyperTrain() {
    if (isTraining) return;
    isTraining = true;
    modeController.stopAuto();

    const overlay = document.getElementById('training-overlay');
    const bar = document.getElementById('train-progress');
    const status = document.getElementById('train-status');
    if (overlay) overlay.style.display = 'flex';

    const GAMES_TO_TRAIN = 50;
    const oldLevel = ai1.level;
    rebuildTrainingPlayers();
    ai1.setLevel(2);
    ai2.setLevel(2);

    try {
        for (let i = 1; i <= GAMES_TO_TRAIN && isTraining; i++) {
            session.reset();
            pgnManager.startNewGame(
                `${ai1.getStrategyName()} AI`,
                `${ai2.getStrategyName()} AI`,
                'training'
            );
            let moves = 0;

            if (status) status.innerText = `Game ${i}/${GAMES_TO_TRAIN}`;
            if (bar) bar.style.width = `${(i / GAMES_TO_TRAIN) * 100}%`;

            while (!session.game.gameOver && moves < 150 && isTraining) {
                const aiToUse = session.game.turn === COLORS.WHITE ? ai1 : ai2;
                const m = await aiToUse.getBestMove(session.game, session.game.turn, true);

                if (m) {
                    session.executeAndRecordMove(m.from, m.to);
                    if (moves % 5 === 0) boardView.render();
                    const st = session.game.checkStatus();
                    if (st.over) {
                        session.finalizeTrainingGame(st);
                    }
                } else {
                    break;
                }

                moves++;
                if (moves % 20 === 0) await new Promise((r) => setTimeout(r, 0));
            }
        }
    } catch (err) {
        console.error('Hyper-train failed:', err);
        if (status) status.innerText = `Training stopped: ${err.message}`;
    } finally {
        // #region agent log
        fetch('http://127.0.0.1:7740/ingest/f890c3d0-303f-46d6-beb2-79c6d41b60da',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07a98d'},body:JSON.stringify({sessionId:'07a98d',location:'ui.js:hyperTrain:finally',message:'hypertrain end',data:{isTraining},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        endHyperTrainSession({ overlay, oldLevel });
        updateGameHistory();
        resetGame();
    }
}

updateGameHistory();
