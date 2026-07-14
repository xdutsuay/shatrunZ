#!/usr/bin/env node
/**
 * Dumps eval_core.js (HCE) outputs for the P2 parity gate
 * (crates/shatrunz-core/tests/eval_hce_parity.rs). Positions are the same
 * startpos + 20 seeded random-openings used by tools/js/perft.mjs, read
 * from the already-generated perft fixture so both gates exercise the
 * same position set.
 *
 * Usage: node tools/js/eval_dump.mjs > crates/shatrunz-core/tests/fixtures/eval_hce_fixture.json
 */
import { readFileSync } from 'node:fs';
import { Game } from '../../frontend/game.js';
import {
    evaluatePositionWhite,
    evaluateForSearch,
} from '../../frontend/shared/eval_core.js';
import { moveToUCI } from '../../frontend/shared/uci.js';

const PERSONAS = ['material', 'positional', 'aggressive'];
const fixturePath = new URL(
    '../../crates/shatrunz-core/tests/fixtures/perft_fixture.json',
    import.meta.url
);
const perftFixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

function dumpForGame(game, label) {
    const entry = { label, evals: {} };
    for (const persona of PERSONAS) {
        entry.evals[persona] = {
            white: evaluatePositionWhite(game.board, persona),
            forSearch: evaluateForSearch(game.board, game.turn, persona),
        };
    }
    return entry;
}

const out = { positions: [] };

out.positions.push(dumpForGame(new Game(), 'startpos'));

for (const seeded of perftFixture.seeded) {
    const game = new Game();
    const uciMoves = [];
    for (const mv of seeded.path) {
        const pieceBefore = game.board[mv.from.r][mv.from.c];
        uciMoves.push(moveToUCI(mv.from, mv.to, pieceBefore));
        game.executeMove(mv.from, mv.to);
    }
    const entry = dumpForGame(game, `seed${seeded.seed}`);
    entry.uciMoves = uciMoves;
    entry.position_key = game.getHash();
    out.positions.push(entry);
}

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
