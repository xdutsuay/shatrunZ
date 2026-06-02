import { COLORS } from './constants.js';
import { Rules } from './rules.js';
import { AIPlayer } from './ai.js';
import { PGNManager } from './pgn.js';
import { MODES, isAiTurn as isAiTurnFor } from './mode_logic.js';
import { GameSession } from './shared/game_session.js';
import { BoardView } from './shared/board_view.js';
import { brainNameFor } from './shared/brain_utils.js';
import {
    formatEvalPawns,
    engineStatusLabel,
    depthForLevel,
} from './shared/persona.js';
import { getSettings } from './shared/settings_store.js';
import { getEnginePersonaForSide, setClockProvider } from './shared/engine_move.js';
import { evaluatePositionWhite, evaluateGameOverDisplay } from './shared/eval_core.js';
import { strategyForPersona } from './shared/engine_move.js';
import { replayGameFromUci } from './shared/replay.js';
import { ReplayStepController } from './shared/replay_step.js';
import { explainMove } from './shared/move_explainer.js';
import { buildMoveListHtml } from './shared/move_list.js';
import { loadPolicyMetrics, formatMetricsPanel } from './shared/policy_net.js';
import { setHelpStatusText } from './shared/help_signal.js';
import { ClockController, formatClock } from './shared/clock_controller.js';
import { SettingsKeys, setBool, setNum } from './shared/settings_store.js';
import { PvpModeController } from './modes/pvp.js';
import { PvaiModeController } from './modes/pvai.js';
import { AivaiModeController, strategyFromSelect } from './modes/aivai.js';

const EXPLAIN_KEY = 'shatrunz_enable_move_explain';
const POLICY_KEY = 'shatrunz_use_policy_net';

let currentMode = MODES.HVH;
let modeController;

let ai1 = new AIPlayer(3, 'material', 'persona_material');
let ai2 = new AIPlayer(3, 'positional', 'persona_positional');
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
const evalDisplayEl = document.getElementById('eval-display');
const engineStatusEl = document.getElementById('engine-status');
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
        updateLiveNavControls();
        syncHelpButton();
    },
    updateOpponentName,
    updateModePanels,
    rebuildAivaiPlayers,
    rebuildPvaiPlayer,
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
    updateLiveNavControls();
    syncHelpButton();
    if (isClockEnabled()) {
        const aiMode = currentMode === MODES.CVC || currentMode === MODES.HVC;
        const waitForStart = aiMode && !modeController?.autoRunning;
        const paused = isTraining || reviewState != null || getGame().gameOver
            || modeController?.helpMode || waitForStart;
        clock.setPaused(paused);
        clock.setTurn(getGame().turn);
        if (waitForStart) renderClocks({ whiteMs: clock.whiteMs, blackMs: clock.blackMs });
    }
}

function startClocks() {
    if (!isClockEnabled()) return;
    const { totalMs, incrementMs } = getClockSettings();
    clock.reset({ totalMs, incrementMs, turn: session.game.turn, startPaused: false });
    clock.setTurn(session.game.turn);
}

Object.assign(ctx, {
    clearSelection: clearSelectionLocal,
    refreshUi: refreshUiLocal,
    startClocks,
});

modeController = new PvpModeController(ctx);
modeController.ctx = ctx;

function aiLevel() {
    const fromDom = document.getElementById('ai-level')?.value;
    if (fromDom != null) return parseInt(fromDom, 10);
    return getSettings().aiLevel || 3;
}

function rebuildAivaiPlayers() {
    const level = aiLevel();
    const s1 = strategyFromSelect('white');
    const s2 = strategyFromSelect('black');
    ai1 = new AIPlayer(level, s1, brainNameFor({ strategy: s1 }));
    ai2 = new AIPlayer(level, s2, brainNameFor({ strategy: s2 }));
    ai1.setStrategy(s1);
    ai2.setStrategy(s2);
    ai1.setLevel(level);
    ai2.setLevel(level);
    currentAI = ai1;
    syncAiRefs();
}

function rebuildPvaiPlayer() {
    const level = aiLevel();
    const pid = getEnginePersonaForSide('solo');
    const jsStrategy = pid === 'c_native' ? 'material' : pid;
    currentAI = new AIPlayer(level, jsStrategy, brainNameFor({ strategy: pid, personaId: pid }));
    currentAI.setStrategy(pid === 'c_native' ? 'c_native' : pid);
    currentAI.setLevel(level);
    syncAiRefs();
}

function syncAiRefs() {
    ctx.ai1 = ai1;
    ctx.ai2 = ai2;
    ctx.currentAI = currentAI;
}

ctx.rebuildAivaiPlayers = rebuildAivaiPlayers;
ctx.rebuildPvaiPlayer = rebuildPvaiPlayer;
function updateModePanels() {
    const aivaiOnly = document.getElementById('aivai-only-controls');
    const playAs = document.getElementById('play-as-group');
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
    return getSettings().enableMoveExplain;
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
    setClockProvider(() => ({
        clock,
        incrementMs: getClockSettings().incrementMs,
    }));
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
    if (document.getElementById('ml-metrics-panel')) refreshMlMetrics();

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
    document.getElementById('btn-undo')?.addEventListener('click', () => modeController.onUndo());
    document.getElementById('reset-game')?.addEventListener('click', resetGame);

    document.getElementById('white-ai-strategy')?.addEventListener('change', onAivaiStrategyChange);
    document.getElementById('black-ai-strategy')?.addEventListener('change', onAivaiStrategyChange);
    document.getElementById('computer-side')?.addEventListener('change', () => {
        if (modeController.autoRunning && !getGame().gameOver && currentMode === MODES.HVC) {
            modeController.triggerAiMove();
        }
    });

    document.getElementById('start-auto')?.addEventListener('click', () => modeController.startAuto());
    document.getElementById('stop-auto')?.addEventListener('click', () => modeController.stopAuto());
    document.getElementById('btn-help-ai')?.addEventListener('click', () => {
        if (modeController.helpMode) {
            modeController.helpMode = false;
            modeController.resumeAfterHelp();
        } else {
            modeController.pauseForHelp('');
            setHelpStatusText(statusEl, getGame().turn, '');
        }
    });

    document.getElementById('export-pgn')?.addEventListener('click', () => pgnManager.exportCurrentGame());

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
        if (w) w.value = ai1.getStrategyKey();
        if (b) b.value = ai2.getStrategyKey();
        return;
    }

    rebuildAivaiPlayers();
    updateOpponentName();
    refreshUiLocal();
}

function updateBrainStats() {
    // Stats live on Admin → Stats tab (persona keys, not per-side duplicates).
}

function getDisplayGame() {
    if (pgnManager.currentGame) return pgnManager.currentGame;
    if (pgnManager.games?.length) return pgnManager.games[0];
    return null;
}

function updateMoveList() {
    if (!moveListEl) return;
    const game = getDisplayGame();
    if (!game?.moves?.length) {
        moveListEl.innerHTML = '<div class="move-empty">No moves yet</div>';
        return;
    }
    const curPly = currentNavPly();
    const help = pgnManager.getHelpSummary(game);
    const helpHtml = help ? `<div class="move-help-note">— ${help}</div>` : '';
    moveListEl.innerHTML = buildMoveListHtml(game, curPly) + helpHtml;
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

function personaKeyForDisplay(game) {
    if (currentMode === MODES.HVC) {
        return strategyForPersona(getEnginePersonaForSide('solo'));
    }
    if (currentMode === MODES.CVC) {
        const pid = getEnginePersonaForSide(game.turn === COLORS.WHITE ? 'white' : 'black');
        return strategyForPersona(pid);
    }
    return 'material';
}

function updateStatus() {
    const game = getGame();
    const status = game.checkStatus();
    statusEl.innerText = status.msg;
    const materialCp = game.getScore();
    const evalEl = document.getElementById('eval-display');
    const engineEl = document.getElementById('engine-status');

    const personaKey = personaKeyForDisplay(game);
    let evalCpWhite = evaluatePositionWhite(game.board, personaKey);
    if (status.over && status.winner != null) {
        evalCpWhite = evaluateGameOverDisplay(status.winner);
    }

    if (evalEl) {
        evalEl.textContent = formatEvalPawns(evalCpWhite);
        evalEl.classList.toggle('eval-negative', evalCpWhite < 0);
    }
    if (scoreEl) {
        const txt = materialCp === 0 ? 'Equal' : formatEvalPawns(materialCp);
        scoreEl.innerText = `Material: ${txt}`;
    }
    if (engineEl) {
        const pid = currentMode === MODES.HVC
            ? getEnginePersonaForSide('solo')
            : getEnginePersonaForSide(game.turn === COLORS.WHITE ? 'white' : 'black');
        engineEl.textContent = engineStatusLabel({
            personaId: pid,
            level: aiLevel(),
            depth: depthForLevel(aiLevel()),
        });
    }
    const evalBar = document.getElementById('eval-bar');
    if (evalBar) {
        const pct = Math.max(0, Math.min(100, 50 + (evalCpWhite / 40)));
        evalBar.style.height = `${pct}%`;
    }
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

    const whiteName = currentMode === MODES.CVC ? `${ai1.getStrategyName()} AI` : 'White';
    const blackName = currentMode === MODES.CVC ? `${ai2.getStrategyName()} AI`
        : currentMode === MODES.HVC ? `${currentAI.getStrategyName()} AI` : 'Black';

    pgnManager.startNewGame(whiteName, blackName, currentMode);
    boardView.render();
    refreshUiLocal();
    updateLiveNavControls();
    if (isClockEnabled()) {
        const { totalMs, incrementMs } = getClockSettings();
        clock.reset({ totalMs, incrementMs, turn: session.game.turn, startPaused: true });
        renderClocks({ whiteMs: clock.whiteMs, blackMs: clock.blackMs });
    }
    if (moveExplainEl) moveExplainEl.textContent = '';
}

function handleLevelChange(e) {
    const level = parseInt(e?.target?.value ?? aiLevel(), 10);
    setNum(SettingsKeys.aiLevel, level);

    const allowMidgame = getSettings().allowMidgamePersonaChange;
    const inProgress = currentMode === MODES.CVC && !replayController && session.uciMoveHistory.length > 0 && !getGame().gameOver;
    if (!allowMidgame && inProgress && e?.target) {
        e.target.value = String(ai1.level);
        const lbl = document.getElementById('ai-level-label');
        if (lbl) lbl.innerText = ai1.level;
        return;
    }

    const lbl = document.getElementById('ai-level-label');
    if (lbl) lbl.innerText = level;
    if (currentMode === MODES.CVC) rebuildAivaiPlayers();
    else if (currentMode === MODES.HVC) rebuildPvaiPlayer();
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

updateGameHistory();
