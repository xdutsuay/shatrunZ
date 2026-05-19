import { PIECES, WEIGHTS } from '../constants.js';

const PERSONA_PREFIX = {
    material: 'Material AI',
    positional: 'Positional AI',
    aggressive: 'Aggressive AI',
};

export function explainMove({ move, persona, captured, isCheck, isCheckmate }) {
    const p = (persona || 'material').toLowerCase();
    const label = PERSONA_PREFIX[p] || 'AI';
    const parts = [`${label}:`];

    if (isCheckmate) {
        parts.push('delivers checkmate.');
        return parts.join(' ');
    }

    if (captured) {
        const val = WEIGHTS[captured.type] || 0;
        if (p === 'aggressive') {
            parts.push(`captures ${pieceName(captured.type)} — pressing the attack.`);
        } else if (p === 'material') {
            parts.push(`takes ${pieceName(captured.type)} (about +${val} material).`);
        } else {
            parts.push(`exchanges on ${squareName(move.to)}; wins the ${pieceName(captured.type)}.`);
        }
    } else if (p === 'positional') {
        parts.push(`improves piece placement toward ${squareName(move.to)}.`);
    } else if (p === 'aggressive') {
        parts.push(`advances toward ${squareName(move.to)} to increase pressure.`);
    } else {
        parts.push(`plays to ${squareName(move.to)}.`);
    }

    if (isCheck) {
        parts.push('The enemy king is in check.');
    }

    return parts.join(' ');
}

function pieceName(type) {
    const names = {
        [PIECES.PAWN]: 'pawn',
        [PIECES.KNIGHT]: 'knight',
        [PIECES.BISHOP]: 'bishop',
        [PIECES.ROOK]: 'rook',
        [PIECES.QUEEN]: 'queen',
        [PIECES.KING]: 'king',
        [PIECES.KRISHNA]: 'Krishna',
    };
    return names[type] || 'piece';
}

function squareName({ r, c }) {
    const files = 'abcdefghi';
    return `${files[c]}${9 - r}`;
}
