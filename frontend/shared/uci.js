import { PIECES } from '../constants.js';

const FILES = 'abcdefghi';

export function parseUCIMove(uciMove) {
    if (!uciMove || typeof uciMove !== 'string' || uciMove.length < 4) {
        return null;
    }

    const fromFile = FILES.indexOf(uciMove[0]);
    const fromRank = 9 - parseInt(uciMove[1], 10);
    const toFile = FILES.indexOf(uciMove[2]);
    const toRank = 9 - parseInt(uciMove[3], 10);

    if (fromFile < 0 || toFile < 0) return null;
    if (Number.isNaN(fromRank) || fromRank < 0 || fromRank >= 9) return null;
    if (Number.isNaN(toRank) || toRank < 0 || toRank >= 9) return null;

    return {
        from: { r: fromRank, c: fromFile },
        to: { r: toRank, c: toFile },
    };
}

export function moveToUCI(from, to, movedPiece) {
    const fromFile = FILES[from.c];
    const toFile = FILES[to.c];
    const fromRank = 9 - from.r;
    const toRank = 9 - to.r;

    if (!fromFile || !toFile || fromRank < 1 || fromRank > 9 || toRank < 1 || toRank > 9) {
        return null;
    }

    let promo = '';
    if (movedPiece && movedPiece.type === PIECES.PAWN && (to.r === 0 || to.r === 8)) {
        promo = 'q';
    }
    return `${fromFile}${fromRank}${toFile}${toRank}${promo}`;
}
