import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { Rules } from '../frontend/rules.js';
import { assertGameInvariants, boardToAscii } from './invariants/game_invariants.js';

function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function summarizeMove(m) {
    return `${m.from.r},${m.from.c}->${m.to.r},${m.to.c}${m.to.isCastling ? '(castle)' : ''}`;
}

test('fuzz: core rules invariants hold under random play + undo (60s)', async (t) => {
    const SEED = Number(process.env.FUZZ_SEED || Date.now()) >>> 0;
    const rng = mulberry32(SEED);
    const deadlineMs = Date.now() + 60_000;

    const game = new Game();
    assertGameInvariants(game, { label: 'init' });

    let plies = 0;
    const moveLog = [];
    const hashStack = [];

    while (Date.now() < deadlineMs) {
        const legal = Rules.getAllLegalMoves(game.board, game.turn);

        if (legal.length === 0) {
            // Game ended (checkmate/stalemate/adjudication). Reset to keep exploring.
            const st = game.checkStatus();
            assert.equal(st.over, true, `expected game over when no legal moves (seed=${SEED})`);
            // basic sanity: status should be consistent
            game.gameOver = true;
            // reset
            const g2 = new Game();
            game.board = g2.board;
            game.turn = g2.turn;
            game.gameOver = false;
            game.moveHistory = [];
            game.positionHistory = {};
            assertGameInvariants(game, { label: 'reset' });
            moveLog.length = 0;
            hashStack.length = 0;
            continue;
        }

        const m = pick(rng, legal);
        const beforeHash = game.getHash();
        hashStack.push(beforeHash);

        try {
            game.executeMove(m.from, m.to);
        } catch (e) {
            assert.fail(`executeMove threw (seed=${SEED}) move=${summarizeMove(m)} err=${e?.message || e}\n${boardToAscii(game.board)}`);
        }

        moveLog.push(summarizeMove(m));
        assertGameInvariants(game, { label: `after ply ${plies} seed=${SEED} last=${moveLog[moveLog.length - 1]}` });

        // Occasionally undo 1–3 plies and ensure hash restores.
        if (plies > 4 && rng() < 0.12) {
            const undoCount = 1 + Math.floor(rng() * 3);
            for (let i = 0; i < undoCount && game.moveHistory.length > 0; i++) {
                const expected = hashStack.pop();
                const ok = game.undoLastMove();
                assert.equal(ok, true, `undoLastMove returned false unexpectedly (seed=${SEED})`);
                assertGameInvariants(game, { label: `after undo seed=${SEED}` });
                const cur = game.getHash();
                assert.equal(cur, expected, `hash mismatch after undo (seed=${SEED})\nexpected=${expected}\nactual=${cur}\nlog_tail=${moveLog.slice(-10).join(' ')}`);
                moveLog.pop();
            }
        }

        plies++;

        // Avoid pathological long games in one line; reset occasionally.
        if (plies > 250 && rng() < 0.05) {
            const g2 = new Game();
            game.board = g2.board;
            game.turn = g2.turn;
            game.gameOver = false;
            game.moveHistory = [];
            game.positionHistory = {};
            plies = 0;
            moveLog.length = 0;
            hashStack.length = 0;
            assertGameInvariants(game, { label: `random reset seed=${SEED}` });
        }

        // Let node test runner breathe.
        if (plies % 500 === 0) await new Promise(r => setTimeout(r, 0));
    }

    t.diagnostic(`seed=${SEED} plies=${plies}`);
});

