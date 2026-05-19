import test from 'node:test';
import assert from 'node:assert/strict';

import { PGNManager } from '../frontend/pgn.js';
import { importPgnText } from '../frontend/shared/pgn_parse.js';

test('help move round-trip in PGN export/import', () => {
    const pgn = new PGNManager();
    pgn.games = [];
    pgn.startNewGame('W', 'B', 'hvc');
    pgn.recordUciMove('d2d3');
    pgn.currentGame.moves.push('d3');
    pgn.recordHelpMove(1, 'b', 'd2d3', 'eval swing (319 cp)');

    const exported = pgn.exportPGN();
    assert.match(exported, /\[HelpMoves "1:b:d2d3"\]/);

    const parsed = importPgnText(exported);
    assert.equal(parsed.help_plies.length, 1);
    assert.equal(parsed.help_plies[0].ply, 1);
    assert.equal(parsed.help_plies[0].side, 'b');
    assert.equal(parsed.help_plies[0].uci, 'd2d3');
});

test('getHelpSummary counts by side', () => {
    const pgn = new PGNManager();
    pgn.startNewGame('W', 'B', 'cvc');
    pgn.recordHelpMove(3, 'w', 'e2e3');
    pgn.recordHelpMove(7, 'b', 'e7e6');
    const summary = pgn.getHelpSummary();
    assert.match(summary, /2 human-helped/);
    assert.match(summary, /White: 1/);
    assert.match(summary, /Black: 1/);
});
