#!/usr/bin/env node
/**
 * Dumps frontend/ai.js's AIPlayer.getBestMove output for the P3 search
 * parity gate (crates/shatrunz-core/tests/search_persona_parity.rs),
 * using the *real* ai.js/brain.js code (not a reimplementation) with an
 * in-memory localStorage polyfill so brain memory/values/stats are always
 * empty — giving a genuinely deterministic, bonus-free baseline that
 * matches P3's "no randomness/bonuses/deadline" config from the plan.
 * budgetMs is omitted (0) so getBestMove takes the single-fixed-depth
 * path, not iterative deepening; fastMode=true skips the (irrelevant,
 * UI-only) setTimeout yield.
 *
 * Usage: node tools/js/search_persona_dump.mjs > crates/shatrunz-core/tests/fixtures/search_persona_fixture.json
 */
const memoryStore = new Map();
globalThis.localStorage = {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
};
// policy_net.js's isPolicyNetEnabled() reads a DOM checkbox before falling
// back to settings_store; getElementById returning null forces that
// fallback, which resolves to false (usePolicyNet defaults off).
globalThis.document = { getElementById: () => null };

import { readFileSync } from 'node:fs';
import { Game } from '../../frontend/game.js';
import { AIPlayer } from '../../frontend/ai.js';
import { moveToUCI } from '../../frontend/shared/uci.js';

const PERSONAS = ['material', 'positional', 'aggressive'];
const DEPTHS = [2, 3];

const fixturePath = new URL(
    '../../crates/shatrunz-core/tests/fixtures/perft_fixture.json',
    import.meta.url
);
const perftFixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

async function dumpForGame(game, label, uciMoves) {
    const entry = { label, uciMoves, results: {} };
    for (const persona of PERSONAS) {
        entry.results[persona] = {};
        for (const depth of DEPTHS) {
            // Fresh player + fresh board copy per (persona, depth): getBestMove
            // mutates the board via makeMove/undoMove internally but always
            // restores it, so reusing `game` across calls is safe — a fresh
            // player just avoids any brain-state carryover between calls.
            memoryStore.clear();
            const player = new AIPlayer(3, persona, `dump_${persona}`);
            player.depth = depth;
            const bestMove = await player.getBestMove(game, game.turn, true, { budgetMs: 0 });
            const pieceBefore = bestMove ? game.board[bestMove.from.r][bestMove.from.c] : null;
            entry.results[persona][`depth${depth}`] = {
                uci: bestMove ? moveToUCI(bestMove.from, bestMove.to, pieceBefore) : null,
                bestScore: player.lastDecision.bestScore,
                secondScore: player.lastDecision.secondScore,
                depthReached: player.lastDecision.depthReached,
            };
        }
    }
    return entry;
}

async function main() {
    const out = { positions: [] };
    out.positions.push(await dumpForGame(new Game(), 'startpos', []));
    for (const seeded of perftFixture.seeded) {
        const game = new Game();
        const uciMoves = [];
        for (const mv of seeded.path) {
            const pieceBefore = game.board[mv.from.r][mv.from.c];
            uciMoves.push(moveToUCI(mv.from, mv.to, pieceBefore));
            game.executeMove(mv.from, mv.to);
        }
        out.positions.push(await dumpForGame(game, `seed${seeded.seed}`, uciMoves));
    }
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main();
