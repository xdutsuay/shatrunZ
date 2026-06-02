import { COLORS } from '../constants.js';

function clampMs(ms) {
    return Math.max(0, Math.floor(ms));
}

export function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export class ClockController {
    constructor({ totalMs = 0, incrementMs = 0, now = () => performance.now() } = {}) {
        this.totalMs = clampMs(totalMs);
        this.incrementMs = clampMs(incrementMs);
        this._now = now;
        this._raf = null;
        this._lastTs = null;
        this._running = false;
        this._paused = true;
        this._turn = COLORS.WHITE;
        this.whiteMs = this.totalMs;
        this.blackMs = this.totalMs;
        this.onTick = null;
        this.onFlagFall = null;
    }

    reset({ totalMs = this.totalMs, incrementMs = this.incrementMs, turn = COLORS.WHITE, startPaused = false } = {}) {
        this.totalMs = clampMs(totalMs);
        this.incrementMs = clampMs(incrementMs);
        this.whiteMs = this.totalMs;
        this.blackMs = this.totalMs;
        this._turn = turn;
        this._lastTs = null;
        this.stop();
        this._paused = !!startPaused;
        this._emit();
        if (!startPaused) {
            this._paused = false;
            this._ensureLoop();
        }
    }

    setPaused(paused) {
        this._paused = !!paused;
        if (!this._paused) this._ensureLoop();
        else this.stop();
    }

    isPaused() {
        return this._paused;
    }

    setTurn(turn) {
        this._turn = turn;
    }

    onMoveMade(sideMoved, nextTurn) {
        if (sideMoved === COLORS.WHITE) this.whiteMs = clampMs(this.whiteMs + this.incrementMs);
        else if (sideMoved === COLORS.BLACK) this.blackMs = clampMs(this.blackMs + this.incrementMs);
        if (nextTurn) this._turn = nextTurn;
        this._emit();
    }

    stop() {
        this._paused = true;
        this._running = false;
        if (this._raf != null) cancelAnimationFrame(this._raf);
        this._raf = null;
        this._lastTs = null;
    }

    _emit() {
        if (this.onTick) {
            this.onTick({
                whiteMs: this.whiteMs,
                blackMs: this.blackMs,
                turn: this._turn,
            });
        }
    }

    _ensureLoop() {
        // Node tests do not provide requestAnimationFrame; degrade gracefully.
        if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') {
            this._running = false;
            return;
        }
        if (this._running) return;
        this._running = true;
        const loop = (ts) => {
            if (!this._running) return;
            if (this._paused) {
                this._raf = null;
                this._running = false;
                return;
            }

            if (this._lastTs == null) this._lastTs = ts;
            const dt = Math.max(0, ts - this._lastTs);
            this._lastTs = ts;

            if (this._turn === COLORS.WHITE) this.whiteMs = clampMs(this.whiteMs - dt);
            else this.blackMs = clampMs(this.blackMs - dt);

            this._emit();

            if (this.whiteMs <= 0 || this.blackMs <= 0) {
                const fell = this.whiteMs <= 0 ? COLORS.WHITE : COLORS.BLACK;
                this._paused = true;
                if (this.onFlagFall) this.onFlagFall(fell);
            }

            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }
}

