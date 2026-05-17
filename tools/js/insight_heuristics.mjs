/** Pure helpers for insight selection (testable without I/O). */

export function loserFromResult(result) {
    if (result === '1-0') return 'b';
    if (result === '0-1') return 'w';
    return null;
}

/** Ply indices to consider: 0 .. min(openingDepth, moveCount) - 1 (inclusive). */
export function openingPliesToReview(openingDepth, moveCount) {
    const n = Math.min(openingDepth, moveCount);
    const out = [];
    for (let i = 0; i < n; i++) out.push(i);
    return out;
}
