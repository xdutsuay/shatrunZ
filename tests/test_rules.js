const { Rules } = require('../frontend/rules.js');
const { BOARD_SIZE, PIECES, COLORS } = require('../frontend/constants.js');
const assert = require('assert');

// Mock board setup helper
function createEmptyBoard() {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    return board;
}

function testKrishnaMovement() {
    console.log("Testing Krishna Movement...");
    const board = createEmptyBoard();
    const center = Math.floor(BOARD_SIZE / 2);

    // Place Krishna in center
    board[center][center] = { type: PIECES.KRISHNA, color: COLORS.WHITE };

    // Get moves
    const moves = Rules.getLegalMoves(board, center, center, false); // false = disable check safety for pure move test

    // Krishna moves like King: 8 directions, 1 step
    assert.strictEqual(moves.length, 8, `Krishna should have 8 moves from center, got ${moves.length}`);
    console.log("PASS: Krishna center moves");
}

function testKrishnaInvincibility() {
    console.log("Testing Krishna Invincibility...");
    const board = createEmptyBoard();
    const center = Math.floor(BOARD_SIZE / 2);

    // Place White Krishna
    board[center][center] = { type: PIECES.KRISHNA, color: COLORS.WHITE };

    // Place Black Rook adjacent
    board[center][center + 1] = { type: PIECES.ROOK, color: COLORS.BLACK };

    // Get Rook moves
    const moves = Rules.getLegalMoves(board, center, center + 1, false);

    // Check if Rook captures Krishna
    const capturesKrishna = moves.some(m => m.r === center && m.c === center);

    assert.strictEqual(capturesKrishna, false, "Black Rook should NOT be able to capture Krishna");
    console.log("PASS: Krishna cannot be captured");
}

try {
    testKrishnaMovement();
    testKrishnaInvincibility();
    console.log("\n✅ All Frontend Tests Passed!");
} catch (e) {
    console.error("\n❌ Test Failed:", e.message);
    process.exit(1);
}
