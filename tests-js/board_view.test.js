import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { BoardView } from '../frontend/shared/board_view.js';
import { Rules } from '../frontend/rules.js';

function installMinimalDocument() {
    if (global.document?.createElement) return () => {};
    global.document = {
        createElement(tag) {
            const el = {
                tagName: tag.toUpperCase(),
                className: '',
                classList: { add(...c) { this.className += ' ' + c.join(' '); } },
                innerText: '',
                childNodes: [],
                appendChild(child) {
                    this.childNodes.push(child);
                    child.parent = this;
                },
                onclick: null,
            };
            return el;
        },
    };
    return () => {
        delete global.document;
    };
}

function mockBoardEl() {
    const squares = [];
    return {
        innerHTML: '',
        appendChild(el) {
            squares.push(el);
        },
        get squares() {
            return squares;
        },
    };
}

test('BoardView renders full grid when isTraining is true (no early exit)', () => {
    const teardown = installMinimalDocument();
    const boardEl = mockBoardEl();
    const game = new Game();
    const view = new BoardView({
        boardEl,
        getGame: () => game,
        getSelection: () => ({ selectedSq: null, legalMoves: [] }),
        onSquareClick: () => {},
        isTraining: () => true,
    });

    view.render();
    assert.equal(boardEl.squares.length, 81, '9x9 board should render all squares');
    teardown();
});

test('BoardView reflects executeMove on the game (not stuck at start)', () => {
    const teardown = installMinimalDocument();
    const boardEl = mockBoardEl();
    const game = new Game();
    const from = { r: 7, c: 3 };
    const to = { r: 5, c: 3 };
    assert.ok(Rules.getLegalMoves(game.board, from.r, from.c).some((m) => m.r === to.r && m.c === to.c));
    game.executeMove(from, to);

    const view = new BoardView({
        boardEl,
        getGame: () => game,
        getSelection: () => ({ selectedSq: null, legalMoves: [] }),
        onSquareClick: () => {},
        isTraining: () => false,
    });
    view.render();

    const dest = boardEl.squares.find((sq) =>
        [...sq.childNodes].some((n) => n.className?.includes?.('piece'))
        && sq.className.includes('square')
    );
    assert.ok(dest, 'at least one square should contain a piece glyph');
    const movedSq = boardEl.squares[5 * 9 + 3];
    const pieceOnDest = [...movedSq.childNodes].find((n) => n.className?.includes?.('piece'));
    assert.ok(pieceOnDest, 'destination square should show a piece after d-pawn advance');
    teardown();
});
