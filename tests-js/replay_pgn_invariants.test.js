import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { Rules } from '../frontend/rules.js';
import { moveToUCI, parseUCIMove } from '../frontend/shared/uci.js';
import { ReplayStepController } from '../frontend/shared/replay_step.js';
import { assertGameInvariants } from './invariants/game_invariants.js';

function buildRandomUciLine({ maxPlies = 80, seed = 12345 } = {}) {
    // Tiny deterministic RNG
    let a = seed >>> 0;
    const rng = () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const game = new Game();
    const uci = [];

    for (let ply = 0; ply < maxPlies; ply++) {
        const legal = Rules.getAllLegalMoves(game.board, game.turn);
        if (legal.length === 0) break;
        const m = legal[Math.floor(rng() * legal.length)];
        const moved = game.board[m.from.r][m.from.c];
        const u = moveToUCI(m.from, m.to, moved);
        assert.ok(u, `failed to encode UCI at ply=${ply}`);
        game.executeMove(m.from, m.to);
        uci.push(u);
        if (game.checkStatus().over) break;
    }

    return uci;
}

test('ReplayStepController rebuild matches incremental executeMove (random line)', () => {
    const uciMoves = buildRandomUciLine({ maxPlies: 60, seed: 424242 });

    const rc = new ReplayStepController(uciMoves);
    const g = new Game();
    assertGameInvariants(g, { label: 'init' });

    for (let ply = 0; ply <= uciMoves.length; ply++) {
        rc.stepTo(ply);
        assertGameInvariants(rc.game, { label: `replay ply=${ply}` });

        // Step g incrementally to the same ply
        while (g.moveHistory.length > ply) g.undoLastMove();
        while (g.moveHistory.length < ply) {
            const parsed = parseUCIMove(uciMoves[g.moveHistory.length]);
            assert.ok(parsed, `bad UCI in test: ${uciMoves[g.moveHistory.length]}`);
            g.executeMove(parsed.from, parsed.to);
        }

        assertGameInvariants(g, { label: `live ply=${ply}` });
        assert.equal(rc.game.getHash(), g.getHash(), `hash mismatch at ply=${ply}`);
    }
});

