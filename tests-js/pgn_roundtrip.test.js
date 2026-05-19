import test from 'node:test';
import assert from 'node:assert/strict';

import { PGNManager } from '../frontend/pgn.js';
import { importPgnText } from '../frontend/shared/pgn_parse.js';

test('exportPGN includes UciMoves tag and import round-trips', () => {
    const pgn = new PGNManager();
    pgn.games = [];
    pgn.startNewGame('Alice', 'Bob', 'hvh');
    pgn.recordUciMove('e2e3');
    pgn.currentGame.moves.push('e3');
    pgn.recordUciMove('e7e6');
    pgn.currentGame.moves.push('e6');
    pgn.currentGame.result = '1-0';

    const exported = pgn.exportPGN();
    assert.match(exported, /\[UciMoves "e2e3 e7e6"\]/);

    const parsed = importPgnText(exported);
    assert.equal(parsed.uci_moves.length, 2);
    assert.equal(parsed.uci_moves[0], 'e2e3');
    assert.equal(parsed.moves.length, 2);

    const imp = pgn.importPgnFile(exported);
    assert.ok(imp.ok);
    assert.equal(pgn.games[0].uci_moves.join(' '), 'e2e3 e7e6');
});

test('importPgnText parses headers and movetext', () => {
    const text = `[Event "Test"]
[White "W"]
[Black "B"]
[UciMoves "a2a3 b9b8"]

1. a3 b8 1-0`;
    const parsed = importPgnText(text);
    assert.equal(parsed.headers.White, 'W');
    assert.equal(parsed.uci_moves[0], 'a2a3');
    assert.equal(parsed.result, '1-0');
});
