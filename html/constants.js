export const BOARD_SIZE = 9;
export const FILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
export const COLORS = { WHITE: 'w', BLACK: 'b' };
export const PIECES = { PAWN: 'p', ROOK: 'r', KNIGHT: 'n', BISHOP: 'b', QUEEN: 'q', KING: 'k', KRISHNA: 'z' };
export const SYMBOLS = {
    w: { p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔', z: '☸' },
    b: { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', z: '☸' }
};
export const WEIGHTS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000, z: 0 };
