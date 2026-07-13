//! Piece/color primitives. Char codecs and weights mirror
//! `frontend/constants.js:3-9` byte-for-byte (used by `Game::position_key`
//! and `Game::get_score`, both external contracts — see docs/RUST_PORT.md).

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Color {
    White,
    Black,
}

impl Color {
    pub fn opposite(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }

    /// Matches `COLORS = { WHITE: 'w', BLACK: 'b' }` (constants.js:3).
    pub fn as_char(self) -> char {
        match self {
            Color::White => 'w',
            Color::Black => 'b',
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PieceKind {
    Pawn,
    Rook,
    Knight,
    Bishop,
    Queen,
    King,
    /// Uncapturable, moves one step to empty squares only, blocks sliding
    /// rays. See docs/RUST_PORT.md "Rules / movement".
    Krishna,
}

impl PieceKind {
    /// Matches `PIECES` (constants.js:4).
    pub fn as_char(self) -> char {
        match self {
            PieceKind::Pawn => 'p',
            PieceKind::Rook => 'r',
            PieceKind::Knight => 'n',
            PieceKind::Bishop => 'b',
            PieceKind::Queen => 'q',
            PieceKind::King => 'k',
            PieceKind::Krishna => 'z',
        }
    }

    /// Matches `WEIGHTS` (constants.js:9).
    pub fn weight(self) -> i32 {
        match self {
            PieceKind::Pawn => 100,
            PieceKind::Knight => 320,
            PieceKind::Bishop => 330,
            PieceKind::Rook => 500,
            PieceKind::Queen => 900,
            PieceKind::King => 20000,
            PieceKind::Krishna => 1200,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Piece {
    pub color: Color,
    pub kind: PieceKind,
}
