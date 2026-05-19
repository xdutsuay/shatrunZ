import { BOARD_SIZE, FILES, PIECES, SYMBOLS } from '../constants.js';
import { Rules } from '../rules.js';

export class BoardView {
    constructor({ boardEl, getGame, getSelection, onSquareClick, isTraining }) {
        this.boardEl = boardEl;
        this.getGame = getGame;
        this.getSelection = getSelection;
        this.onSquareClick = onSquareClick;
        this.isTraining = isTraining;
    }

    render() {
        const game = this.getGame();
        // #region agent log
        fetch('http://127.0.0.1:7740/ingest/f890c3d0-303f-46d6-beb2-79c6d41b60da',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07a98d'},body:JSON.stringify({sessionId:'07a98d',location:'board_view.js:render',message:'board render',data:{isTraining:!!this.isTraining?.(),moveHistoryLen:game?.moveHistory?.length??-1,ply:game?.moveHistory?.length??0},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        const { selectedSq, legalMoves } = this.getSelection();

        let checkKingPos = null;
        try {
            if (Rules.isKingInCheck(game.board, game.turn)) {
                for (let rr = 0; rr < BOARD_SIZE; rr++) {
                    for (let cc = 0; cc < BOARD_SIZE; cc++) {
                        const pp = game.board[rr][cc];
                        if (pp && pp.color === game.turn && pp.type === PIECES.KING) {
                            checkKingPos = { r: rr, c: cc };
                            break;
                        }
                    }
                    if (checkKingPos) break;
                }
            }
        } catch (_) {
            checkKingPos = null;
        }

        this.boardEl.innerHTML = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const sq = document.createElement('div');
                sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                sq.onclick = () => this.onSquareClick(r, c);

                if (c === 0) {
                    const t = document.createElement('span');
                    t.className = 'coord rank';
                    t.innerText = 9 - r;
                    sq.appendChild(t);
                }
                if (r === 8) {
                    const t = document.createElement('span');
                    t.className = 'coord file';
                    t.innerText = FILES[c];
                    sq.appendChild(t);
                }

                if (selectedSq && selectedSq.r === r && selectedSq.c === c) {
                    sq.classList.add('selected');
                }

                const lastMove = game.moveHistory[game.moveHistory.length - 1];
                if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) ||
                    (lastMove.to.r === r && lastMove.to.c === c))) {
                    sq.classList.add('last-move');
                }

                if (checkKingPos && checkKingPos.r === r && checkKingPos.c === c) {
                    sq.classList.add('in-check');
                }

                const isLegal = legalMoves.find(m => m.r === r && m.c === c);
                if (isLegal) {
                    if (game.board[r][c]) sq.classList.add('capture-move');
                    else sq.classList.add('legal-move');
                }

                const p = game.board[r][c];
                if (p) {
                    const d = document.createElement('div');
                    d.className = `piece ${p.color === 'w' ? 'white-piece' : 'black-piece'} ${p.type === PIECES.KRISHNA ? 'krishna' : ''}`;
                    d.innerText = SYMBOLS[p.color][p.type];
                    sq.appendChild(d);
                }

                this.boardEl.appendChild(sq);
            }
        }
    }
}
