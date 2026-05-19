/** Composite "AI asks for help" signal (OR of enabled sub-signals). */

import { COLORS } from '../constants.js';

export const DEFAULT_HELP_THRESHOLDS = {
    evalSwing: 250,
    margin: 30,
    unknownMaxCount: 2,
    repeatCount: 3,
};

const AUTO_HELP_KEY = 'shatrunz_ai_auto_help';
const HELP_KEY = 'shatrunz_enable_ai_help';

export function getHelpSignalSettings() {
    const ls = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null };
    const flag = (k, def = true) => {
        const v = ls.getItem(k);
        if (v === null) return def;
        return v === '1';
    };
    return {
        enableHelp: flag(HELP_KEY, false),
        autoAsk: flag(AUTO_HELP_KEY, false),
        evalSwing: flag('shatrunz_help_eval_swing', true),
        lowMargin: flag('shatrunz_help_low_margin', true),
        unknown: flag('shatrunz_help_unknown', true),
        repeat: flag('shatrunz_help_repeat', true),
    };
}

export function readHelpThresholdsFromStorage() {
    const ls = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null };
    const num = (k, def) => {
        const v = ls.getItem(k);
        if (v === null || v === '') return def;
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    };
    return {
        evalSwing: num('shatrunz_thresh_eval_swing', DEFAULT_HELP_THRESHOLDS.evalSwing),
        margin: num('shatrunz_thresh_margin', DEFAULT_HELP_THRESHOLDS.margin),
        unknownMaxCount: num('shatrunz_thresh_unknown', DEFAULT_HELP_THRESHOLDS.unknownMaxCount),
        repeatCount: num('shatrunz_thresh_repeat', DEFAULT_HELP_THRESHOLDS.repeatCount),
    };
}

/**
 * @param {{ game, brain, decision?, prevEval?, thresholds, settings }} ctx
 * @returns {{ ask: boolean, reason: string }}
 */
export function evaluateNeedsHelp(ctx) {
    const { game, brain, decision, prevEval, thresholds, settings } = ctx;
    if (!settings.autoAsk || !settings.enableHelp) {
        return { ask: false, reason: '' };
    }

    const reasons = [];
    const hash = game.getHash();

    if (settings.evalSwing && decision != null && prevEval != null && Number.isFinite(prevEval)) {
        const swing = Math.abs((decision.bestScore ?? 0) - prevEval);
        if (swing > thresholds.evalSwing) {
            reasons.push(`eval swing (${Math.round(swing)} cp)`);
        }
    }

    if (settings.lowMargin && decision != null) {
        const margin = (decision.bestScore ?? 0) - (decision.secondScore ?? -Infinity);
        if (!Number.isFinite(margin) || margin < thresholds.margin) {
            reasons.push(`low margin (${Math.round(margin)} cp)`);
        }
    }

    if (settings.unknown && brain) {
        const mem = brain.memory[hash];
        const n = mem ? Object.values(mem).reduce((a, b) => a + b, 0) : 0;
        if (!mem || n < thresholds.unknownMaxCount) {
            reasons.push('unknown position');
        }
    }

    if (settings.repeat) {
        const cnt = game.positionHistory[hash] || 0;
        if (cnt >= thresholds.repeatCount) {
            reasons.push('repetition risk');
        }
    }

    return {
        ask: reasons.length > 0,
        reason: reasons.join('; '),
    };
}

/** Human-readable side label for the side asking for help. */
export function sideLabel(turn) {
    return turn === COLORS.WHITE ? 'White' : 'Black';
}

/**
 * Primary: "White is asking for help". Secondary: technical reason (optional).
 */
export function formatHelpStatus(turn, reason = '') {
    const primary = `${sideLabel(turn)} is asking for help`;
    if (!reason) return { primary, full: primary };
    return { primary, secondary: reason, full: `${primary} (${reason})` };
}

/** Apply help status text to the status bar. */
export function setHelpStatusText(statusEl, turn, reason = '') {
    if (!statusEl) return;
    const { primary, secondary } = formatHelpStatus(turn, reason);
    statusEl.innerHTML = secondary
        ? `${primary}<br><span class="help-reason-detail">${secondary}</span>`
        : primary;
}

/** @returns {boolean} true if help was requested */
export function maybeAutoAskHelp(controller, { game, brain, decision, prevEval }) {
    const settings = getHelpSignalSettings();
    const thresholds = readHelpThresholdsFromStorage();
    const { ask, reason } = evaluateNeedsHelp({
        game,
        brain,
        decision,
        prevEval,
        thresholds,
        settings,
    });
    if (!ask) return false;
    controller.pauseForHelp(reason);
    setHelpStatusText(controller.ctx?.statusEl, game.turn, reason);
    return true;
}
