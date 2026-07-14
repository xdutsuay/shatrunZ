//! Faithful port of `frontend/game.js`. `position_key` and the status
//! strings are FROZEN external contracts — see docs/RUST_PORT.md "Game
//! state".

use std::collections::HashMap;

use crate::board::{Board, BOARD_SIZE};
use crate::moves::{Move, MoveTarget, Square};
use crate::piece::{Color, Piece, PieceKind};
use crate::rules;

#[derive(Debug, Clone)]
struct CastlingRookMove {
    from: Square,
    to: Square,
    piece: Piece,
}

#[derive(Debug, Clone)]
struct HistoryEntry {
    from: Square,
    to: Square,
    /// Piece as it was *before* this move (pre-promotion), so undo can
    /// restore it directly — mirrors `movedPiece: {...p}` in game.js:49,
    /// snapshotted before the promotion mutation at game.js:62.
    moved_piece: Piece,
    captured_piece: Option<Piece>,
    prev_turn: Color,
    castling_rook: Option<CastlingRookMove>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Status {
    pub over: bool,
    pub msg: String,
    pub winner: Option<Color>,
}

#[derive(Debug, Clone)]
pub struct Game {
    pub board: Board,
    pub turn: Color,
    pub game_over: bool,
    move_history: Vec<HistoryEntry>,
    position_history: HashMap<String, u32>,
}

impl Default for Game {
    fn default() -> Self {
        Self::new()
    }
}

impl Game {
    pub fn new() -> Self {
        Game {
            board: Board::setup(),
            turn: Color::White,
            game_over: false,
            move_history: Vec::new(),
            position_history: HashMap::new(),
        }
    }

    /// **FROZEN.** `"{turn}|"` + `"{color}{kind}{r}{c}"` per occupied
    /// square, row-major. External contract: SQLite tablebase key via
    /// `/api/tablebase?key=`. Mirrors `getHash` (game.js:25-34) byte for
    /// byte — do not reformat.
    pub fn position_key(&self) -> String {
        let mut s = String::new();
        s.push(self.turn.as_char());
        s.push('|');
        for r in 0..BOARD_SIZE {
            for c in 0..BOARD_SIZE {
                if let Some(p) = self.board.get(r, c) {
                    s.push(p.color.as_char());
                    s.push(p.kind.as_char());
                    s.push_str(&r.to_string());
                    s.push_str(&c.to_string());
                }
            }
        }
        s
    }

    /// All legal moves for `color`, board-scan order preserved. Mirrors
    /// `Rules.getAllLegalMoves` called with `this.board` (rules.js:6-19).
    pub fn legal_moves(&self, color: Color) -> Vec<Move> {
        rules::get_all_legal_moves(&self.board, color)
    }

    fn has_legal_moves(&self, color: Color) -> bool {
        for r in 0..BOARD_SIZE {
            for c in 0..BOARD_SIZE {
                if let Some(p) = self.board.get(r, c) {
                    if p.color == color
                        && !rules::get_legal_moves(&self.board, r, c, true).is_empty()
                    {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Mirrors `executeMove` (game.js:36-95). Returns false if there's no
    /// piece at `from` or it isn't `self.turn`'s piece — same rejection as
    /// the JS console.warn path.
    pub fn execute_move(&mut self, from: Square, to: MoveTarget) -> bool {
        let p = match self.board.get(from.r, from.c) {
            Some(p) => p,
            None => return false,
        };
        if p.color != self.turn {
            return false;
        }
        let captured = self.board.get(to.r, to.c);

        let mut entry = HistoryEntry {
            from,
            to: to.to_square(),
            moved_piece: p,
            captured_piece: captured,
            prev_turn: self.turn,
            castling_rook: None,
        };

        self.board.set(to.r, to.c, Some(p));
        self.board.set(from.r, from.c, None);

        // Promotion: JS rules auto-queen at row 0/8 (game.js:61-64).
        if p.kind == PieceKind::Pawn && (to.r == 0 || to.r == 8) {
            let mut promoted = p;
            promoted.kind = PieceKind::Queen;
            self.board.set(to.r, to.c, Some(promoted));
        }

        if to.is_castling {
            let rank = from.r;
            let is_kingside = to.c > from.c;
            let rook_from_col = if is_kingside { 8 } else { 0 };
            let rook_to_col = if is_kingside { 5 } else { 3 };
            if let Some(rook) = self.board.get(rank, rook_from_col) {
                self.board.set(rank, rook_to_col, Some(rook));
                self.board.set(rank, rook_from_col, None);
                entry.castling_rook = Some(CastlingRookMove {
                    from: Square { r: rank, c: rook_from_col },
                    to: Square { r: rank, c: rook_to_col },
                    piece: rook,
                });
            }
        }

        self.turn = self.turn.opposite();
        self.move_history.push(entry);

        let new_key = self.position_key();
        *self.position_history.entry(new_key).or_insert(0) += 1;
        true
    }

    /// Mirrors `undoLastMove` (game.js:173-198).
    pub fn undo_last_move(&mut self) -> bool {
        let last = match self.move_history.pop() {
            Some(l) => l,
            None => return false,
        };

        let current_key = self.position_key();
        if let Some(count) = self.position_history.get_mut(&current_key) {
            if *count > 0 {
                *count -= 1;
            }
        }

        self.board.set(last.from.r, last.from.c, Some(last.moved_piece));
        self.board.set(last.to.r, last.to.c, last.captured_piece);

        if let Some(cr) = &last.castling_rook {
            self.board.set(cr.from.r, cr.from.c, Some(cr.piece));
            self.board.set(cr.to.r, cr.to.c, None);
        }

        self.turn = last.prev_turn;
        self.game_over = false;
        true
    }

    /// Mirrors `checkStatus` (game.js:200-233). Status strings and the
    /// repetition/adjudication thresholds are FROZEN — see
    /// docs/RUST_PORT.md "Game state".
    pub fn check_status(&self) -> Status {
        let in_check = rules::is_king_in_check(&self.board, self.turn);
        let has_moves = self.has_legal_moves(self.turn);

        let key = self.position_key();
        if *self.position_history.get(&key).unwrap_or(&0) >= 5 {
            return Status {
                over: true,
                msg: "Draw by Repetition".to_string(),
                winner: None,
            };
        }

        if self.move_history.len() >= 240 {
            let score = self.get_score();
            if score.abs() >= 300 {
                let winner = if score > 0 { Color::White } else { Color::Black };
                return Status {
                    over: true,
                    msg: format!(
                        "Adjudicated: {} wins (material)",
                        color_name(winner)
                    ),
                    winner: Some(winner),
                };
            }
        }

        if !has_moves {
            if in_check {
                let winner = self.turn.opposite();
                return Status {
                    over: true,
                    msg: format!("CHECKMATE! {} Wins", color_name(winner)),
                    winner: Some(winner),
                };
            }
            return Status {
                over: true,
                msg: "Stalemate".to_string(),
                winner: None,
            };
        }

        let mut msg = if self.turn == Color::White {
            "White's Turn".to_string()
        } else {
            "Black's Turn".to_string()
        };
        if in_check {
            msg.push_str(" (CHECK)");
        }
        Status {
            over: false,
            msg,
            winner: None,
        }
    }

    /// Mirrors `getScore` (game.js:246-258): white material minus black.
    pub fn get_score(&self) -> i32 {
        let mut w = 0i32;
        let mut b = 0i32;
        for r in 0..BOARD_SIZE {
            for c in 0..BOARD_SIZE {
                if let Some(p) = self.board.get(r, c) {
                    if p.color == Color::White {
                        w += p.kind.weight();
                    } else {
                        b += p.kind.weight();
                    }
                }
            }
        }
        w - b
    }
}

fn color_name(color: Color) -> &'static str {
    match color {
        Color::White => "White",
        Color::Black => "Black",
    }
}
