import {
    SettingsKeys,
    getSettings,
    setBool,
    setNum,
    setStr,
} from './shared/settings_store.js';
import {
    readPersonaStatsFromStorage,
    personaLabel,
    ENGINE_PERSONAS,
} from './shared/persona.js';
import { GameBrain } from './brain.js';
import { PGNManager } from './pgn.js';
import { loadPolicyMetrics, formatMetricsPanel } from './shared/policy_net.js';
import { runHyperTrain, cancelHyperTrain } from './shared/hyper_train.js';
import { renderPersonaChart } from './shared/persona_chart.js';
import { BackendAPI } from './api.js';

function fmtStats(stats) {
    const w = stats?.wins ?? 0;
    const l = stats?.losses ?? 0;
    const d = stats?.draws ?? 0;
    const g = stats?.games ?? 0;
    return `${w}W-${l}L-${d}D (games: ${g})`;
}

function renderPersonaStats(el) {
    const items = readPersonaStatsFromStorage();
    if (items.every((x) => (x.stats?.games ?? 0) === 0)) {
        el.textContent = 'No persona stats yet. Play or hyper-train to populate.';
        return;
    }
    el.innerHTML = items.map(({ name, stats, label }) => {
        const title = label || personaLabel(name);
        return `<div class="brain-row"><strong>${title}</strong><br>${fmtStats(stats)}</div>`;
    }).join('<hr class="sep">');
}

function switchTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.admin-panel').forEach((panel) => {
        const show = panel.id === `tab-${tabId}`;
        panel.classList.toggle('active', show);
        panel.hidden = !show;
    });
}

const pgnManager = new PGNManager();

export function initAdmin() {
    const statusEl = document.getElementById('admin-status');
    const statsEl = document.getElementById('admin-persona-stats');
    const apiStatsEl = document.getElementById('admin-api-stats');
    const runsEl = document.getElementById('admin-training-runs');

    document.querySelectorAll('.admin-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
            if (btn.dataset.tab === 'stats') {
                if (statsEl) renderPersonaStats(statsEl);
                renderPersonaChart(document.getElementById('admin-persona-chart'));
            }
        });
    });

    const s = getSettings();
    const allowEl = document.getElementById('admin-allow-midgame-persona');
    const clocksEl = document.getElementById('admin-enable-clocks');
    const totalEl = document.getElementById('admin-clock-total-min');
    const incEl = document.getElementById('admin-clock-increment-sec');
    const thinkEl = document.getElementById('admin-think-time-ms');
    const levelEl = document.getElementById('ai-level');
    const levelLabel = document.getElementById('ai-level-label');
    const engineEl = document.getElementById('engine-persona');
    const randomEl = document.getElementById('add-randomness');
    const helpEl = document.getElementById('enable-ai-help');
    const autoHelpEl = document.getElementById('enable-ai-auto-help');
    const explainEl = document.getElementById('enable-move-explain');
    const policyEl = document.getElementById('use-policy-net');

    if (allowEl) allowEl.checked = s.allowMidgamePersonaChange;
    if (clocksEl) clocksEl.checked = s.enableClocks;
    if (totalEl) totalEl.value = String(Math.floor(s.clockTotalMs / 60000));
    if (incEl) incEl.value = String(Math.floor(s.clockIncrementMs / 1000));
    if (thinkEl) thinkEl.value = String(s.thinkTimeMs || 0);
    if (levelEl) levelEl.value = String(s.aiLevel);
    if (levelLabel) levelLabel.textContent = String(s.aiLevel);
    if (engineEl) engineEl.value = s.enginePersona || 'material';
    if (randomEl) randomEl.checked = s.randomness;
    if (helpEl) helpEl.checked = s.enableHelp;
    if (autoHelpEl) autoHelpEl.checked = s.autoHelp;
    if (explainEl) explainEl.checked = s.enableMoveExplain;
    if (policyEl) policyEl.checked = s.usePolicyNet;

    levelEl?.addEventListener('input', () => {
        if (levelLabel) levelLabel.textContent = levelEl.value;
    });

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

    document.getElementById('admin-save')?.addEventListener('click', () => {
        setBool(SettingsKeys.allowMidgamePersonaChange, !!allowEl?.checked);
        setBool(SettingsKeys.enableClocks, !!clocksEl?.checked);
        setNum(SettingsKeys.clockTotalMs, Number(totalEl?.value || 0) * 60_000);
        setNum(SettingsKeys.clockIncrementMs, Number(incEl?.value || 0) * 1_000);
        setNum(SettingsKeys.thinkTimeMs, Number(thinkEl?.value || 0));
        setNum(SettingsKeys.aiLevel, Number(levelEl?.value || 3));
        setStr(SettingsKeys.enginePersona, engineEl?.value || 'material');
        setBool(SettingsKeys.randomness, !!randomEl?.checked);
        setBool(SettingsKeys.enableHelp, !!helpEl?.checked);
        setBool(SettingsKeys.autoHelp, !!autoHelpEl?.checked);
        setBool(SettingsKeys.enableMoveExplain, !!explainEl?.checked);
        setBool(SettingsKeys.usePolicyNet, !!policyEl?.checked);
        localStorage.setItem('shatrunz_enable_move_explain', explainEl?.checked ? '1' : '0');
        localStorage.setItem('shatrunz_use_policy_net', policyEl?.checked ? '1' : '0');

        if (statusEl) statusEl.textContent = 'Saved. Settings apply on play page.';
    });

    if (statsEl) renderPersonaStats(statsEl);
    renderPersonaChart(document.getElementById('admin-persona-chart'));

    if (apiStatsEl) {
        fetch('/api/stats/summary')
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data) {
                    apiStatsEl.textContent = 'API stats unavailable (endpoint optional). Use local persona table above.';
                    return;
                }
                apiStatsEl.textContent = JSON.stringify(data, null, 2);
            })
            .catch(() => {
                apiStatsEl.textContent = 'API stats unavailable. Use local persona table above.';
            });
    }

    document.getElementById('btn-inspector-last')?.addEventListener('click', async () => {
        if (statusEl) statusEl.textContent = 'Running inspector…';
        const games = pgnManager.games;
        const last = games[0];
        if (!last) {
            if (statusEl) statusEl.textContent = 'No saved games in history.';
            return;
        }
        const res = await BackendAPI.inspectorAnalyze({ game: last });
        if (statusEl) {
            statusEl.textContent = res.success
                ? `Inspector done (${res.source}). See terminal / ${res.log_file || 'data/logs'}.`
                : `Inspector failed: ${res.error || 'unknown'}`;
        }
    });

    document.getElementById('btn-inspector-bulk')?.addEventListener('click', async () => {
        if (statusEl) statusEl.textContent = 'Bulk inspector running…';
        const res = await BackendAPI.inspectorBulk();
        if (statusEl) {
            statusEl.textContent = res.success
                ? `Bulk report: ${res.log_file || 'data/logs'}. See server terminal.`
                : `Bulk failed: ${res.error || 'unknown'}`;
        }
    });

    if (runsEl) {
        fetch('/api/training-runs')
            .then((r) => r.json())
            .then((data) => {
                const runs = data?.runs || [];
                if (runs.length === 0) {
                    runsEl.textContent = 'No runs yet.';
                    return;
                }
                runsEl.innerHTML = runs.slice(0, 10).map((run) => {
                    const cps = run.calls_per_second ?? 0;
                    const mins = run.minutes ?? 0;
                    const depth = run.depth ?? 0;
                    const title = run.id || run._file || 'run';
                    return `<div class="brain-row"><strong>${title}</strong><br>${mins}m @ depth ${depth} — ${cps} calls/s</div>`;
                }).join('<hr class="sep">');
            })
            .catch((e) => {
                runsEl.textContent = `Failed to load runs: ${e?.message || e}`;
            });
    }

    refreshMlMetrics();
    updateGameHistory();
    loadDbStats();

    document.getElementById('btn-policy-train')?.addEventListener('click', () => {
        startPolicyTraining(statusEl);
    });

    document.getElementById('btn-hyper-train')?.addEventListener('click', async () => {
        await runHyperTrain();
        const statsEl = document.getElementById('admin-persona-stats');
        if (statsEl) renderPersonaStats(statsEl);
        if (statusEl) statusEl.textContent = 'Hyper-train finished.';
    });
    document.getElementById('cancel-train')?.addEventListener('click', () => {
        cancelHyperTrain();
    });

    document.getElementById('reset-brain')?.addEventListener('click', resetAllPersonaBrains);
    document.getElementById('export-brain')?.addEventListener('click', exportAllBrains);
    document.getElementById('import-brain')?.addEventListener('click', () => {
        document.getElementById('brain-file')?.click();
    });
    document.getElementById('brain-file')?.addEventListener('change', importBrains);

    document.getElementById('clear-history')?.addEventListener('click', () => {
        if (confirm('Clear all game history?')) {
            pgnManager.clearHistory();
            updateGameHistory();
        }
    });
    document.getElementById('load-game')?.addEventListener('click', () => {
        const select = document.getElementById('game-history');
        const gameData = pgnManager.getGame(parseInt(select?.value ?? '', 10));
        if (gameData?.uci_moves?.length) {
            alert(`Loaded ${gameData.white} vs ${gameData.black}. Open play page to replay.`);
        }
    });
    document.getElementById('import-pgn')?.addEventListener('click', () => {
        document.getElementById('pgn-file')?.click();
    });
    document.getElementById('pgn-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = pgnManager.importPgnFile(reader.result);
            if (result.ok) {
                updateGameHistory();
                if (statusEl) statusEl.textContent = 'PGN imported.';
            } else {
                alert('Import failed: ' + (result.error || 'unknown'));
            }
        };
        reader.readAsText(file);
    });
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

async function refreshMlMetrics() {
    const el = document.getElementById('ml-metrics-panel');
    if (!el) return;
    const metrics = await loadPolicyMetrics();
    el.textContent = formatMetricsPanel(metrics);
}

async function loadDbStats() {
    const el = document.getElementById('admin-db-stats');
    if (!el) return;
    try {
        const res = await fetch('/api/db/stats').then((r) => r.json());
        if (!res.success) throw new Error(res.error || 'failed');
        const s = res.stats;
        const byResult = Object.entries(s.by_result || {})
            .map(([k, v]) => `  ${k}: ${v}`).join('\n');
        el.textContent =
            `games: ${s.games}\nmoves: ${s.moves}\n` +
            `tablebase positions (<=${s.max_pieces} pieces): ${s.tablebase_positions}\n` +
            `endgame move rows: ${s.endgame_move_rows}\nby result:\n${byResult}`;
    } catch (e) {
        el.textContent = `DB stats unavailable: ${e?.message || e}`;
    }
}

function startPolicyTraining(statusEl) {
    const logEl = document.getElementById('policy-train-log');
    const btn = document.getElementById('btn-policy-train');
    const epochs = parseInt(document.getElementById('policy-epochs')?.value || '3', 10);
    const maxGames = parseInt(document.getElementById('policy-max-games')?.value || '200', 10);
    const onlyDecisive = document.getElementById('policy-only-decisive')?.checked || false;

    if (logEl) logEl.textContent = 'Starting…\n';
    if (btn) btn.disabled = true;

    fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epochs, max_games: maxGames, only_decisive: onlyDecisive }),
    })
        .then((r) => r.json())
        .then((res) => {
            if (!res.success) {
                if (logEl) logEl.textContent += `Could not start: ${res.error || 'unknown'}\n`;
                if (btn) btn.disabled = false;
                return;
            }
            if (statusEl) statusEl.textContent = `Training ${res.job_id}…`;
            const es = new EventSource('/api/ml/train/stream');
            es.onmessage = (ev) => {
                const line = ev.data;
                if (line.startsWith('__STATUS__')) {
                    const status = line.replace('__STATUS__', '').trim();
                    if (statusEl) statusEl.textContent = `Training ${status}.`;
                    if (btn) btn.disabled = false;
                    es.close();
                    loadDbStats();
                    refreshMlMetrics();
                    return;
                }
                if (logEl) {
                    logEl.textContent += line + '\n';
                    logEl.scrollTop = logEl.scrollHeight;
                }
            };
            es.onerror = () => {
                if (btn) btn.disabled = false;
                es.close();
            };
        })
        .catch((e) => {
            if (logEl) logEl.textContent += `Error: ${e?.message || e}\n`;
            if (btn) btn.disabled = false;
        });
}

function resetAllPersonaBrains() {
    if (!confirm('Reset all persona brain memory? This cannot be undone.')) return;
    for (const p of ENGINE_PERSONAS) {
        const name = p.kind === 'c' ? 'persona_c_native' : `persona_${p.strategy}`;
        new GameBrain(name).clear();
    }
    const statsEl = document.getElementById('admin-persona-stats');
    if (statsEl) renderPersonaStats(statsEl);
}

function exportAllBrains() {
    const combined = {};
    for (const p of ENGINE_PERSONAS) {
        const name = p.kind === 'c' ? 'persona_c_native' : `persona_${p.strategy}`;
        combined[name] = new GameBrain(name).exportToJSON();
    }
    const blob = new Blob([JSON.stringify(combined, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shatrunz_personas_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importBrains(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            for (const [name, brainData] of Object.entries(data)) {
                if (brainData?.memory) {
                    new GameBrain(name).importFromJSON(brainData);
                }
            }
            const statsEl = document.getElementById('admin-persona-stats');
            if (statsEl) renderPersonaStats(statsEl);
            alert('Persona brains imported.');
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}
