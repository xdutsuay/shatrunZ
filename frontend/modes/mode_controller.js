/** Base mode controller — subclasses override lifecycle hooks. */
export class ModeController {
    constructor(ctx) {
        this.ctx = ctx;
        this.autoRunning = false;
        this.aiMoveInFlight = false;
        this.helpMode = false;
        this.resumeAutoAfterHelp = false;
        this._aiMoveTimer = null;
        this._aiChainTimer = null;
        this._aiGen = 0;
    }

    onEnter() {}
    onLeave() {
        this.stopAuto();
        this.helpMode = false;
        this.resumeAutoAfterHelp = false;
    }

    shouldBlockInput() {
        return false;
    }

    onSquareClick(_r, _c) {
        return false;
    }

    onStartAuto() {}
    onStopAuto() {}
    onUndo() {}
    async triggerAiMove() {}

    startAuto() {
        if (this.ctx?.isReviewing) return;
        this.autoRunning = true;
        this.ctx.syncAutoButtons();
        this.onStartAuto();
        this.ctx.startClocks?.();
        this.triggerAiMove();
    }

    stopAuto() {
        this.autoRunning = false;
        this.aiMoveInFlight = false;
        this.helpMode = false;
        this.cancelPendingAiTimers();
        this.ctx.syncAutoButtons();
        this.onStopAuto();
        this.ctx.refreshUi?.();
    }

    cancelPendingAiTimers() {
        this._aiGen++;
        if (this._aiMoveTimer != null) {
            clearTimeout(this._aiMoveTimer);
            this._aiMoveTimer = null;
        }
        if (this._aiChainTimer != null) {
            clearTimeout(this._aiChainTimer);
            this._aiChainTimer = null;
        }
        this.aiMoveInFlight = false;
    }

    bumpAiGeneration() {
        return ++this._aiGen;
    }

    isAiGenerationCurrent(gen) {
        return gen === this._aiGen;
    }

    scheduleAiChain(delayMs, fn) {
        if (this._aiChainTimer != null) clearTimeout(this._aiChainTimer);
        const gen = this._aiGen;
        this._aiChainTimer = setTimeout(() => {
            this._aiChainTimer = null;
            if (gen === this._aiGen) fn();
        }, delayMs);
    }

    pauseForHelp(reason = '') {
        this.resumeAutoAfterHelp = this.autoRunning;
        this.autoRunning = false;
        this.helpMode = true;
        this.helpReason = reason || '';
        this.ctx.syncAutoButtons();
        this.ctx.syncHelpButton();
        this.ctx.refreshUi?.();
    }

    resumeAfterHelp() {
        this.helpMode = false;
        if (this.resumeAutoAfterHelp) {
            this.autoRunning = true;
            this.resumeAutoAfterHelp = false;
            this.ctx.syncAutoButtons();
            this.triggerAiMove();
        }
        this.ctx.syncHelpButton();
    }
}
