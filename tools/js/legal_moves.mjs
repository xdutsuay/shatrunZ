#!/usr/bin/env node
/**
 * Print sorted UCI legal moves for startpos + optional move list.
 * Usage: node tools/js/legal_moves.mjs [uciMove ...]
 */
import { Game } from '../../frontend/game.js';
import { Rules } from '../../frontend/rules.js';
import { parseUCIMove } from '../../frontend/shared/uci.js';

const FILES = 'abcdefghi';

function moveToUciSimple(from, to) {
    return `${FILES[from.c]}${9 - from.r}${FILES[to.c]}${9 - to.r}`;
}

function legalUciList(game) {
    const out = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const p = game.board[r][c];
            if (!p || p.color !== game.turn) continue;
            for (const m of Rules.getLegalMoves(game.board, r, c)) {
                out.push(moveToUciSimple({ r, c }, m));
            }
        }
    }
    return out.sort();
}

const uciArgs = process.argv.slice(2);
const game = new Game();
for (const uci of uciArgs) {
    const parsed = parseUCIMove(uci);
    if (!parsed) {
        console.error(`Invalid UCI: ${uci}`);
        process.exit(1);
    }
    game.executeMove(parsed.from, parsed.to);
}
console.log(legalUciList(game).join(' '));
