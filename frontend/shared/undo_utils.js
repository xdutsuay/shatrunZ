/** Shared undo helpers for mode controllers. */

export function undoPlies(session, count, { brain } = {}) {
    let undone = 0;
    for (let i = 0; i < count; i++) {
        if (!session.undoLastPly({ brain })) break;
        undone++;
    }
    return undone;
}

/**
 * PvAI: after AI replied, undo human+AI pair; on AI turn, undo last human ply only.
 */
export function pvaiUndoPlies(session, isAiTurnNow, brain) {
    const n = session.game.moveHistory.length;
    if (n === 0) return 0;
    const plies = isAiTurnNow() ? 1 : Math.min(2, n);
    return undoPlies(session, plies, { brain });
}
