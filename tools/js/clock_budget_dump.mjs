#!/usr/bin/env node
/**
 * Dumps frontend/shared/clock_budget.js's computeGoTimeMs for a spread of
 * (wtime, btime, winc, binc, side) inputs, for the P2-adjacent clock_budget
 * parity gate (crates/shatrunz-core/tests/clock_budget_parity.rs).
 *
 * Usage: node tools/js/clock_budget_dump.mjs > crates/shatrunz-core/tests/fixtures/clock_budget_fixture.json
 */
import { computeGoTimeMs } from '../../frontend/shared/clock_budget.js';

const CASES = [
    { wtime: 0, btime: 0, winc: 0, binc: 0, side: 'w' },
    { wtime: 60000, btime: 60000, winc: 0, binc: 0, side: 'w' },
    { wtime: 60000, btime: 60000, winc: 0, binc: 0, side: 'b' },
    { wtime: 5000, btime: 5000, winc: 0, binc: 0, side: 'w' },
    { wtime: 100, btime: 5000, winc: 0, binc: 0, side: 'w' },
    { wtime: 0, btime: 5000, winc: 0, binc: 0, side: 'w' },
    { wtime: 5000, btime: 0, winc: 0, binc: 0, side: 'b' },
    { wtime: 300000, btime: 300000, winc: 5000, binc: 5000, side: 'w' },
    { wtime: 300000, btime: 300000, winc: 30000, binc: 30000, side: 'w' },
    { wtime: 1000000, btime: 1000000, winc: 100000, binc: 100000, side: 'w' },
    { wtime: 200, btime: 200, winc: 0, binc: 0, side: 'w' },
    { wtime: 149, btime: 149, winc: 0, binc: 0, side: 'w' },
    { wtime: 151, btime: 151, winc: 0, binc: 0, side: 'w' },
    { wtime: 1, btime: 1, winc: 0, binc: 0, side: 'w' },
    { wtime: 20000, btime: 20000, winc: 1, binc: 1, side: 'w' },
    { wtime: 20000, btime: 20000, winc: 3, binc: 7, side: 'b' },
    { wtime: 3600000, btime: 3600000, winc: 0, binc: 0, side: 'w' },
];

const out = CASES.map((input) => ({ input, budgetMs: computeGoTimeMs(input) }));
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
