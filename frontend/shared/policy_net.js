/**
 * Policy net bonuses via backend (trained on C self-play; legality from JS).
 */

import { moveToUCI } from './uci.js';

const POLICY_KEY = 'shatrunz_use_policy_net';
let metricsCache = null;

export function isPolicyNetEnabled() {
    const el = document.getElementById('use-policy-net');
    if (el) return el.checked;
    return localStorage.getItem(POLICY_KEY) === '1';
}

export async function loadPolicyMetrics() {
    if (metricsCache) return metricsCache;
    try {
        const res = await fetch('/api/ml/metrics');
        if (res.ok) metricsCache = await res.json();
    } catch (_) {
        metricsCache = null;
    }
    return metricsCache;
}

/**
 * Fetch per-move bonuses from backend policy net.
 * @returns {Record<string, number>} uci -> bonus
 */
export async function fetchPolicyBonuses(game, color, moves, uciPrefix = []) {
    if (!isPolicyNetEnabled()) return {};
    const legalUci = moves.map(m => {
        const p = game.board[m.from.r][m.from.c];
        return moveToUCI(m.from, m.to, p);
    }).filter(Boolean);

    try {
        const res = await fetch('/api/ml/policy-hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uci_prefix: uciPrefix, legal_uci: legalUci }),
        });
        if (!res.ok) return {};
        const data = await res.json();
        const bonuses = data.bonuses || {};
        bonuses._uciKey = (move) => {
            const p = game.board[move.from.r][move.from.c];
            return moveToUCI(move.from, move.to, p);
        };
        return bonuses;
    } catch (_) {
        return {};
    }
}

export async function getPolicyBonus(game, from, to) {
    void game;
    void from;
    void to;
    return 0;
}

export function formatMetricsPanel(metrics) {
    if (!metrics) return 'No ML metrics yet. Train with scripts/train_10min.sh or ml/train.py.';
    const lines = [
        `Top-1 accuracy: ${metrics.top1_accuracy ?? '—'}`,
        `Top-3 accuracy: ${metrics.top3_accuracy ?? '—'}`,
        `Precision: ${metrics.precision ?? '—'}`,
        `Recall: ${metrics.recall ?? '—'}`,
        `Positions evaluated: ${metrics.positions_evaluated ?? 0}`,
        'JS engine: policy bonus when toggle on. C engine: train labels only (see docs/engine_roles.md).',
    ];
    if (metrics.note) lines.push(`Note: ${metrics.note}`);
    return lines.join('\n');
}
