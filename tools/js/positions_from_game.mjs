#!/usr/bin/env node
/**
 * Replay a game's UCI moves once on the authoritative 9x9 engine and emit one
 * NDJSON line per position (the position BEFORE each move is played):
 *   { key, piece_count, stm, uci }
 * where `key` is Game.getHash() (turn + piece placements), `stm` is side to move
 * ('w'|'b'), and `uci` is the move played from that position.
 *
 * Usage: node tools/js/positions_from_game.mjs <uciMove> [uciMove ...]
 * Reads moves from argv; emits NDJSON to stdout. Single-game helper for debugging /
 * ad-hoc inspection. Bulk tablebase builds use endgame_positions_stream.mjs (one Node
 * process for many games via stdin) instead.
 */
import { Game } from '../../frontend/game.js';
import { parseUCIMove } from '../../frontend/shared/uci.js';

function pieceCount(game) {
    let n = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (game.board[r][c]) n++;
        }
    }
    return n;
}

const moves = process.argv.slice(2);
const game = new Game();
const out = [];

for (const uci of moves) {
    const parsed = parseUCIMove(uci);
    if (!parsed) break;
    const key = game.getHash();
    const stm = key[0]; // hash starts with the side to move
    out.push(JSON.stringify({ key, piece_count: pieceCount(game), stm, uci }));
    const ok = game.executeMove(parsed.from, parsed.to);
    if (ok === false) break;
}

process.stdout.write(out.join('\n') + (out.length ? '\n' : ''));
