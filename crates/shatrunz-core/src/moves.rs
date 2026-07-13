//! Move types shared by rules/game. The UCI square codec (file a-i,
//! rank = 9-row) lands in M4 alongside `shatrunz-engine`; see
//! docs/RUST_PORT.md "UCI commands".

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Square {
    pub r: usize,
    pub c: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CastlingSide {
    King,
    Queen,
}

/// A candidate destination for the piece at the `(r, c)` passed to
/// `rules::get_legal_moves`. Mirrors the `{r, c, isCastling, side}` shape
/// pushed in rules.js.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MoveTarget {
    pub r: usize,
    pub c: usize,
    pub is_castling: bool,
    pub castling_side: Option<CastlingSide>,
}

impl MoveTarget {
    pub fn plain(r: usize, c: usize) -> Self {
        MoveTarget {
            r,
            c,
            is_castling: false,
            castling_side: None,
        }
    }

    pub fn castling(r: usize, c: usize, side: CastlingSide) -> Self {
        MoveTarget {
            r,
            c,
            is_castling: true,
            castling_side: Some(side),
        }
    }

    pub fn to_square(self) -> Square {
        Square { r: self.r, c: self.c }
    }
}

/// A full move: mirrors the `{from, to}` shape built by
/// `Rules.getAllLegalMoves` (rules.js:6-19).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Move {
    pub from: Square,
    pub to: MoveTarget,
}
