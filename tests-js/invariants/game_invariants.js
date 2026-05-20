import assert from 'node:assert/strict';

import { BOARD_SIZE, COLORS, PIECES } from '../../frontend/constants.js';

const VALID_COLORS = new Set([COLORS.WHITE, COLORS.BLACK]);
const VALID_PIECES = new Set(Object.values(PIECES));

export function boardToAscii(board) {
    const pieceChar = (p) => {
        if (!p) return '.';
        const map = {
            [PIECES.KING]: 'k',
            [PIECES.QUEEN]: 'q',
            [PIECES.ROOK]: 'r',
            [PIECES.BISHOP]: 'b',
            [PIECES.KNIGHT]: 'n',
            [PIECES.PAWN]: 'p',
            [PIECES.KRISHNA]: 'z',
        };
        const ch = map[p.type] || '?';
        return p.color === COLORS.WHITE ? ch.toUpperCase() : ch;
    };

    const lines = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        let row = '';
        for (let c = 0; c < BOARD_SIZE; c++) row += pieceChar(board[r][c]);
        lines.push(row);
    }
    return lines.join('\n');
}

export function assertGameInvariants(game, { label = '' } = {}) {
    assert.ok(game, `${label} game is null/undefined`);
    assert.equal(Array.isArray(game.board), true, `${label} board is not an array`);
    assert.equal(game.board.length, BOARD_SIZE, `${label} board height != ${BOARD_SIZE}`);
    for (let r = 0; r < BOARD_SIZE; r++) {
        assert.equal(Array.isArray(game.board[r]), true, `${label} board row ${r} is not an array`);
        assert.equal(game.board[r].length, BOARD_SIZE, `${label} board row ${r} width != ${BOARD_SIZE}`);
    }

    assert.ok(VALID_COLORS.has(game.turn), `${label} invalid turn: ${String(game.turn)}`);

    let wK = 0, bK = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = game.board[r][c];
            if (p == null) continue;
            assert.equal(typeof p, 'object', `${label} piece at ${r},${c} not object`);
            assert.ok(VALID_COLORS.has(p.color), `${label} invalid piece color at ${r},${c}: ${String(p.color)}`);
            assert.ok(VALID_PIECES.has(p.type), `${label} invalid piece type at ${r},${c}: ${String(p.type)}`);
            if (p.type === PIECES.KING) {
                if (p.color === COLORS.WHITE) wK++;
                else bK++;
            }
        }
    }

    assert.equal(wK, 1, `${label} expected 1 white king, got ${wK}\n${boardToAscii(game.board)}`);
    assert.equal(bK, 1, `${label} expected 1 black king, got ${bK}\n${boardToAscii(game.board)}`);
}

