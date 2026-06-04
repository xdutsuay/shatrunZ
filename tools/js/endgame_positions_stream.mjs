#!/usr/bin/env node
/**
 * Stream endgame positions for many games in ONE Node process (amortizes startup).
 *
 * Reads NDJSON games from stdin, one per line: { "moves": [...uci], "result": "1-0" }.
 * For each position whose total piece count <= maxPieces, emits an NDJSON line:
 *   { key, stm, uci, piece_count, result }
 * Only the position BEFORE each move is emitted (the move is the action taken).
 *
 * Usage: node tools/js/endgame_positions_stream.mjs [maxPieces=9] [maxPlies=300]
 * Games longer than maxPlies are skipped (degenerate self-play loops).
 */
import { createInterface } from 'node:readline';
import { Game } from '../../frontend/game.js';
import { parseUCIMove } from '../../frontend/shared/uci.js';

const maxPieces = parseInt(process.argv[2] || '9', 10);
const maxPlies = parseInt(process.argv[3] || '300', 10);

function pieceCount(game) {
    let n = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (game.board[r][c]) n++;
        }
    }
    return n;
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let buf = [];

function flush() {
    if (buf.length) {
        process.stdout.write(buf.join('\n') + '\n');
        buf = [];
    }
}

rl.on('line', (line) => {
    line = line.trim();
    if (!line) return;
    let obj;
    try { obj = JSON.parse(line); } catch { return; }
    const moves = obj.moves || [];
    const result = obj.result || '*';
    if (!moves.length || moves.length > maxPlies) return;

    const game = new Game();
    for (const uci of moves) {
        const parsed = parseUCIMove(uci);
        if (!parsed) break;
        const pc = pieceCount(game);
        if (pc <= maxPieces) {
            const key = game.getHash();
            buf.push(JSON.stringify({ key, stm: key[0], uci, piece_count: pc, result }));
        }
        if (game.executeMove(parsed.from, parsed.to) === false) break;
    }
    if (buf.length >= 2000) flush();
});

rl.on('close', () => flush());
