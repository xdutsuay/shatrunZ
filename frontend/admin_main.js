import { SettingsKeys, getSettings, setBool, setNum } from './shared/settings_store.js';

function fmtStats(stats) {
    const w = stats?.wins ?? 0;
    const l = stats?.losses ?? 0;
    const d = stats?.draws ?? 0;
    const g = stats?.games ?? 0;
    return `${w}W-${l}L-${d}D (games: ${g})`;
}

function readPersonaStatsFromLocalStorage() {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (!k.startsWith('shatrunz_brain_')) continue;
        if (!k.endsWith('_v3_stats')) continue;
        try {
            const stats = JSON.parse(localStorage.getItem(k));
            const name = k.replace(/^shatrunz_brain_/, '').replace(/_v3_stats$/, '');
            items.push({ name, stats });
        } catch {
            // ignore
        }
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
}

function renderPersonaStats(el) {
    const items = readPersonaStatsFromLocalStorage();
    if (items.length === 0) {
        el.textContent = 'No persona stats found yet. Play some games first.';
        return;
    }
    el.innerHTML = items.map(({ name, stats }) => {
        return `<div class="brain-row"><strong>${name}</strong><br>${fmtStats(stats)}</div>`;
    }).join('<hr class="sep">');
}

export function initAdmin() {
    const statusEl = document.getElementById('admin-status');
    const statsEl = document.getElementById('admin-persona-stats');
    if (statsEl) renderPersonaStats(statsEl);
    const runsEl = document.getElementById('admin-training-runs');
    if (runsEl) runsEl.textContent = 'Loading…';

    const s = getSettings();
    const allowEl = document.getElementById('admin-allow-midgame-persona');
    const clocksEl = document.getElementById('admin-enable-clocks');
    const totalEl = document.getElementById('admin-clock-total-min');
    const incEl = document.getElementById('admin-clock-increment-sec');

    if (allowEl) allowEl.checked = s.allowMidgamePersonaChange;
    if (clocksEl) clocksEl.checked = s.enableClocks;
    if (totalEl) totalEl.value = String(Math.floor(s.clockTotalMs / 60000));
    if (incEl) incEl.value = String(Math.floor(s.clockIncrementMs / 1000));

    document.getElementById('admin-save')?.addEventListener('click', () => {
        setBool(SettingsKeys.allowMidgamePersonaChange, !!allowEl?.checked);
        setBool(SettingsKeys.enableClocks, !!clocksEl?.checked);
        const totalMs = Number(totalEl?.value || 0) * 60_000;
        const incMs = Number(incEl?.value || 0) * 1_000;
        setNum(SettingsKeys.clockTotalMs, totalMs);
        setNum(SettingsKeys.clockIncrementMs, incMs);

        if (statusEl) statusEl.textContent = 'Saved. Settings apply to new games.';
    });

    if (runsEl) {
        fetch('/api/training-runs')
            .then(r => r.json())
            .then((data) => {
                const runs = data?.runs || [];
                if (runs.length === 0) {
                    runsEl.textContent = 'No runs yet. Use scripts/train_benchmark_30m.py to generate one.';
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
}

