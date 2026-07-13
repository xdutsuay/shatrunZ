//! 9x9 board. Setup and `BOARD_SIZE` mirror `frontend/constants.js:1` and
//! `frontend/game.js:15-22` (`initBoard`) byte-for-byte, including the
//! Krishna/Bishop swap comment preserved below.

use crate::piece::{Color, Piece, PieceKind};

pub const BOARD_SIZE: usize = 9;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Board {
    cells: [[Option<Piece>; BOARD_SIZE]; BOARD_SIZE],
}

/// True iff `(r, c)` — as signed offsets from a board square — land on the
/// 9x9 grid. Mirrors `Rules.isWithinBounds` (rules.js:4).
pub fn in_bounds(r: isize, c: isize) -> bool {
    r >= 0 && (r as usize) < BOARD_SIZE && c >= 0 && (c as usize) < BOARD_SIZE
}

impl Board {
    pub fn empty() -> Self {
        Board {
            cells: [[None; BOARD_SIZE]; BOARD_SIZE],
        }
    }

    /// Standard game start. Back rank `R N B Q K B Z N R` — Krishna and
    /// Bishop swapped at index 5/6 vs. a naive `R N B Q K Z N B R` so both
    /// bishops sit on opposite square colors (frontend/game.js:16-17).
    pub fn setup() -> Self {
        let mut b = Board::empty();
        let back = [
            PieceKind::Rook,
            PieceKind::Knight,
            PieceKind::Bishop,
            PieceKind::Queen,
            PieceKind::King,
            PieceKind::Bishop,
            PieceKind::Krishna,
            PieceKind::Knight,
            PieceKind::Rook,
        ];
        for (c, kind) in back.iter().enumerate() {
            b.set(
                0,
                c,
                Some(Piece {
                    color: Color::Black,
                    kind: *kind,
                }),
            );
            b.set(
                8,
                c,
                Some(Piece {
                    color: Color::White,
                    kind: *kind,
                }),
            );
        }
        for c in 0..BOARD_SIZE {
            b.set(
                1,
                c,
                Some(Piece {
                    color: Color::Black,
                    kind: PieceKind::Pawn,
                }),
            );
            b.set(
                7,
                c,
                Some(Piece {
                    color: Color::White,
                    kind: PieceKind::Pawn,
                }),
            );
        }
        b
    }

    #[inline]
    pub fn get(&self, r: usize, c: usize) -> Option<Piece> {
        self.cells[r][c]
    }

    #[inline]
    pub fn set(&mut self, r: usize, c: usize, piece: Option<Piece>) {
        self.cells[r][c] = piece;
    }
}
