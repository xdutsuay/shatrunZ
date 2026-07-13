#!/usr/bin/env node
/**
 * Dumps perft fixtures used by the Rust P1 parity test
 * (crates/shatrunz-core/tests/perft.rs). See docs/plans/PLAN_03_rust_port.md
 * "Parity verification" and docs/RUST_PORT.md "Test replacements".
 *
 * Usage: node tools/js/perft.mjs > crates/shatrunz-core/tests/fixtures/perft_fixture.json
 */
import { Game } from '../../frontend/game.js';
import { Rules } from '../../frontend/rules.js';

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

function perft(game, depth) {
    if (depth === 0) return 1;
    const moves = Rules.getAllLegalMoves(game.board, game.turn);
    let nodes = 0;
    for (const m of moves) {
        game.executeMove(m.from, m.to);
        nodes += perft(game, depth - 1);
        game.undoLastMove();
    }
    return nodes;
}

function randomOpening(seed, plies) {
    const rng = mulberry32(seed);
    const game = new Game();
    const path = [];
    for (let i = 0; i < plies; i++) {
        const moves = Rules.getAllLegalMoves(game.board, game.turn);
        if (moves.length === 0) break;
        const m = moves[Math.floor(rng() * moves.length)];
        game.executeMove(m.from, m.to);
        path.push({
            from: { r: m.from.r, c: m.from.c },
            to: { r: m.to.r, c: m.to.c, isCastling: !!m.to.isCastling },
        });
    }
    return { path, game };
}

const out = { startpos: {}, seeded: [] };

for (const depth of [1, 2, 3]) {
    out.startpos[`depth${depth}`] = perft(new Game(), depth);
}

const SEED_COUNT = 20;
for (let i = 0; i < SEED_COUNT; i++) {
    const seed = 1000 + i;
    const plies = 2 + (seed % 4); // 2-5 random plies of opening
    const { path, game } = randomOpening(seed, plies);
    const depth = 2;
    const nodes = perft(game, depth);
    out.seeded.push({
        seed,
        path,
        depth,
        nodes,
        position_key: game.getHash(),
    });
}

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
