#!/usr/bin/env node
/**
 * Dumps frontend/shared/uci.js's parseUCIMove/moveToUCI for a spread of
 * squares/moves, for the shatrunz-core::uci parity check
 * (crates/shatrunz-core/tests/uci_parity.rs).
 *
 * Usage: node tools/js/uci_dump.mjs > crates/shatrunz-core/tests/fixtures/uci_fixture.json
 */
import { parseUCIMove, moveToUCI } from '../../frontend/shared/uci.js';
import { PIECES, COLORS } from '../../frontend/constants.js';

const UCIS = ['a1a2', 'i9i8', 'e5e4', 'a9i1', 'i1a9', 'e2e4', 'b1c3'];
const parseCases = UCIS.map((uci) => ({ uci, parsed: parseUCIMove(uci) }));

const moveCases = [];
for (const [from, to, type] of [
    [{ r: 7, c: 4 }, { r: 6, c: 4 }, PIECES.PAWN],
    [{ r: 1, c: 0 }, { r: 0, c: 0 }, PIECES.PAWN], // promotion (row 0)
    [{ r: 7, c: 0 }, { r: 8, c: 0 }, PIECES.PAWN], // promotion (row 8, degenerate but exercises the branch)
    [{ r: 8, c: 4 }, { r: 8, c: 6 }, PIECES.KING],
    [{ r: 0, c: 8 }, { r: 5, c: 8 }, PIECES.ROOK],
]) {
    const movedPiece = { type, color: COLORS.WHITE };
    moveCases.push({ from, to, type, uci: moveToUCI(from, to, movedPiece) });
}

process.stdout.write(JSON.stringify({ parseCases, moveCases }, null, 2) + '\n');
