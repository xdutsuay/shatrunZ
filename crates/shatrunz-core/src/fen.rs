//! FEN encode/decode for the C-engine `EnginePosition` (rights-mask
//! castling, 4-way underpromotion variant). Format matches Fairy-Stockfish
//! `engine/variants/shatrunz.ini` and the default in `frontend/pgn.js`:
//! 9 ranks, files a–i, Krishna as `z`/`Z`.
//!
//! Example start FEN (castling field often written `-` in PGN headers even
//! though `EnginePosition::new()` grants full rights via `position startpos`):
//! `rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - - 0 1`

use crate::board::BOARD_SIZE;
use crate::engine_position::{EnginePosition, RIGHT_BK, RIGHT_BQ, RIGHT_WK, RIGHT_WQ};
use crate::piece::{Color, Piece, PieceKind};

/// Canonical start FEN used in PGN headers / Fairy-Stockfish variant ini.
pub const START_FEN: &str =
    "rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - - 0 1";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FenError(pub &'static str);

impl std::fmt::Display for FenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for FenError {}

/// Parse a 6-field FEN string into an `EnginePosition`.
pub fn engine_position_from_fen(fen: &str) -> Result<EnginePosition, FenError> {
    let mut fields = fen.split_whitespace();
    let placement = fields.next().ok_or(FenError("missing piece placement"))?;
    let stm = fields.next().ok_or(FenError("missing side to move"))?;
    let castling = fields.next().ok_or(FenError("missing castling field"))?;
    let ep = fields.next().ok_or(FenError("missing en passant field"))?;
    let halfmove: i32 = fields
        .next()
        .ok_or(FenError("missing halfmove clock"))?
        .parse()
        .map_err(|_| FenError("invalid halfmove clock"))?;
    let fullmove: i32 = fields
        .next()
        .ok_or(FenError("missing fullmove number"))?
        .parse()
        .map_err(|_| FenError("invalid fullmove number"))?;
    if fields.next().is_some() {
        return Err(FenError("too many FEN fields"));
    }

    if ep != "-" {
        return Err(FenError("en passant not supported"));
    }

    let side_to_move = match stm {
        "w" => Color::White,
        "b" => Color::Black,
        _ => return Err(FenError("invalid side to move")),
    };

    let mut board = crate::board::Board::empty();
    let ranks: Vec<&str> = placement.split('/').collect();
    if ranks.len() != BOARD_SIZE {
        return Err(FenError("expected 9 ranks"));
    }
    for (r, rank_str) in ranks.iter().enumerate() {
        let mut c = 0usize;
        let mut chars = rank_str.chars().peekable();
        while let Some(ch) = chars.next() {
            if c >= BOARD_SIZE {
                return Err(FenError("rank overflow"));
            }
            if ch.is_ascii_digit() {
                let mut run = ch.to_digit(10).unwrap() as usize;
                while let Some(&d) = chars.peek() {
                    if d.is_ascii_digit() {
                        run = run * 10 + chars.next().unwrap().to_digit(10).unwrap() as usize;
                    } else {
                        break;
                    }
                }
                c += run;
            } else {
                let piece = piece_from_char(ch).ok_or(FenError("invalid piece char"))?;
                board.set(r, c, Some(piece));
                c += 1;
            }
        }
        if c != BOARD_SIZE {
            return Err(FenError("rank underflow"));
        }
    }

    let castling_rights = parse_castling(castling)?;

    Ok(EnginePosition {
        board,
        side_to_move,
        halfmove_clock: halfmove,
        fullmove_number: fullmove,
        castling_rights,
    })
}

/// Encode `EnginePosition` as a 6-field FEN string.
pub fn engine_position_to_fen(pos: &EnginePosition) -> String {
    let mut ranks = Vec::with_capacity(BOARD_SIZE);
    for r in 0..BOARD_SIZE {
        let mut rank = String::new();
        let mut empty_run = 0usize;
        for c in 0..BOARD_SIZE {
            match pos.board.get(r, c) {
                None => empty_run += 1,
                Some(p) => {
                    if empty_run > 0 {
                        rank.push_str(&empty_run.to_string());
                        empty_run = 0;
                    }
                    rank.push(piece_to_char(p));
                }
            }
        }
        if empty_run > 0 {
            rank.push_str(&empty_run.to_string());
        }
        ranks.push(rank);
    }

    let stm = if pos.side_to_move == Color::White { 'w' } else { 'b' };
    let castling = format_castling(pos.castling_rights);
    format!(
        "{} {} {} - {} {}",
        ranks.join("/"),
        stm,
        castling,
        pos.halfmove_clock,
        pos.fullmove_number
    )
}

fn piece_from_char(ch: char) -> Option<Piece> {
    let (kind, color) = match ch {
        'p' => (PieceKind::Pawn, Color::Black),
        'r' => (PieceKind::Rook, Color::Black),
        'n' => (PieceKind::Knight, Color::Black),
        'b' => (PieceKind::Bishop, Color::Black),
        'q' => (PieceKind::Queen, Color::Black),
        'k' => (PieceKind::King, Color::Black),
        'z' => (PieceKind::Krishna, Color::Black),
        'P' => (PieceKind::Pawn, Color::White),
        'R' => (PieceKind::Rook, Color::White),
        'N' => (PieceKind::Knight, Color::White),
        'B' => (PieceKind::Bishop, Color::White),
        'Q' => (PieceKind::Queen, Color::White),
        'K' => (PieceKind::King, Color::White),
        'Z' => (PieceKind::Krishna, Color::White),
        _ => return None,
    };
    Some(Piece { color, kind })
}

fn piece_to_char(p: Piece) -> char {
    let base = match p.kind {
        PieceKind::Pawn => 'p',
        PieceKind::Rook => 'r',
        PieceKind::Knight => 'n',
        PieceKind::Bishop => 'b',
        PieceKind::Queen => 'q',
        PieceKind::King => 'k',
        PieceKind::Krishna => 'z',
    };
    if p.color == Color::White {
        base.to_ascii_uppercase()
    } else {
        base
    }
}

fn parse_castling(s: &str) -> Result<u8, FenError> {
    if s == "-" {
        return Ok(0);
    }
    let mut rights = 0u8;
    for ch in s.chars() {
        rights |= match ch {
            'K' => RIGHT_WK,
            'Q' => RIGHT_WQ,
            'k' => RIGHT_BK,
            'q' => RIGHT_BQ,
            _ => return Err(FenError("invalid castling char")),
        };
    }
    Ok(rights)
}

fn format_castling(rights: u8) -> String {
    if rights == 0 {
        return "-".to_string();
    }
    let mut s = String::new();
    if rights & RIGHT_WK != 0 {
        s.push('K');
    }
    if rights & RIGHT_WQ != 0 {
        s.push('Q');
    }
    if rights & RIGHT_BK != 0 {
        s.push('k');
    }
    if rights & RIGHT_BQ != 0 {
        s.push('q');
    }
    s
}

/// Split a UCI `position fen …` line into `(fen, optional_moves)`.
/// Returns `None` if the line is not a fen position command.
pub fn parse_position_fen_line(line: &str) -> Option<(String, Vec<String>)> {
    const PREFIX: &str = "position fen ";
    if !line.starts_with(PREFIX) {
        return None;
    }
    let rest = line[PREFIX.len()..].trim();
    if let Some(idx) = rest.find(" moves ") {
        let fen = rest[..idx].trim().to_string();
        let moves: Vec<String> = rest[idx + 7..]
            .split_whitespace()
            .map(str::to_string)
            .collect();
        Some((fen, moves))
    } else {
        Some((rest.to_string(), Vec::new()))
    }
}
