import { COLORS } from '../constants.js';

/** Build Lichess-style move table rows from PGN record (supports move_sides metadata). */
export function buildMoveListHtml(game, curPly = 0) {
    if (!game?.moves?.length) {
        return '<div class="move-empty">No moves yet</div>';
    }

    const moves = game.moves;
    const sides = game.move_sides || [];
    const plies = moves.map((san, i) => ({
        san,
        side: sides[i] || (i % 2 === 0 ? COLORS.WHITE : COLORS.BLACK),
        ply: i + 1,
    }));

    const rows = [];
    let i = 0;
    while (i < plies.length) {
        const num = Math.floor((plies[i].ply - 1) / 2) + 1;
        if (plies[i].side === COLORS.WHITE) {
            const w = plies[i];
            const b = plies[i + 1]?.side === COLORS.BLACK ? plies[i + 1] : null;
            const wClass = curPly === w.ply ? 'move-cell active' : 'move-cell';
            const bClass = b && curPly === b.ply ? 'move-cell active' : 'move-cell';
            const blackCell = b
                ? `<td class="${bClass}">${b.san}</td>`
                : '<td class="move-cell move-cell-empty"></td>';
            rows.push(`<tr><td class="move-num">${num}.</td><td class="${wClass}">${w.san}</td>${blackCell}</tr>`);
            i += b ? 2 : 1;
        } else {
            const blackPly = plies[i];
            const bClass = curPly === blackPly.ply ? 'move-cell active' : 'move-cell';
            rows.push(`<tr><td class="move-num">${num}...</td><td class="move-cell move-cell-empty"></td><td class="${bClass}">${blackPly.san}</td></tr>`);
            i += 1;
        }
    }

    return `<table class="move-table"><tbody>${rows.join('')}</tbody></table>`;
}
