//! UCI binary replacing `engine/uci.c`. Faithful I/O port of the C loop
//! (`uci`/`isready`/`ucinewgame`/`position startpos|fen`/`go`/`legal`/
//! `eval`/`d`/`quit`) over `shatrunz-core::{engine_position,fen,search::engine,
//! eval::engine,clock_budget}`. See docs/RUST_PORT.md.

use std::io::{self, BufRead, Write};

use shatrunz_core::clock_budget::{compute_go_time_ms, ClockBudgetInput};
use shatrunz_core::engine_position::{
    apply_uci_move, engine_move_to_uci, generate_legal_moves, EnginePosition, RIGHT_BK, RIGHT_BQ,
    RIGHT_WK, RIGHT_WQ,
};
use shatrunz_core::eval::engine::evaluate;
use shatrunz_core::fen::{engine_position_from_fen, parse_position_fen_line};
use shatrunz_core::piece::{Color, PieceKind};
use shatrunz_core::search::engine::{search, search_timed};

fn main() {
    let _ = uci_loop();
}

fn uci_loop() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut pos = EnginePosition::new();

    for line in stdin.lock().lines() {
        let line = line?;
        let line = line.trim_end_matches(['\r', '\n']);
        if line.is_empty() {
            continue;
        }

        if line == "uci" {
            writeln!(stdout, "id name ShatrunZ Engine v1.0")?;
            writeln!(stdout, "id author ShatrunZ Team")?;
            writeln!(stdout, "uciok")?;
            stdout.flush()?;
        } else if line == "isready" {
            writeln!(stdout, "readyok")?;
            stdout.flush()?;
        } else if line == "ucinewgame" {
            pos = EnginePosition::new();
        } else if line.starts_with("position fen ") {
            if let Some((fen, moves)) = parse_position_fen_line(line) {
                match engine_position_from_fen(&fen) {
                    Ok(mut p) => {
                        for token in moves {
                            if !apply_uci_move(&mut p, &token) {
                                writeln!(stdout, "info string illegal move in fen position: {token}")?;
                            }
                        }
                        pos = p;
                    }
                    Err(e) => {
                        writeln!(stdout, "info string fen parse error: {e}")?;
                    }
                }
            }
            stdout.flush()?;
        } else if line.starts_with("position startpos") {
            pos = EnginePosition::new();
            if let Some(moves_str) = line.find("moves").map(|i| &line[i + 5..]) {
                for token in moves_str.split_whitespace() {
                    let _ = apply_uci_move(&mut pos, token);
                }
            }
        } else if line == "legal" {
            let legal = generate_legal_moves(&mut pos);
            write!(stdout, "legalmoves")?;
            for mv in &legal {
                write!(stdout, " {}", engine_move_to_uci(mv))?;
            }
            writeln!(stdout)?;
            stdout.flush()?;
        } else if line == "eval" {
            let score = evaluate(&pos.board, pos.side_to_move);
            writeln!(stdout, "info score cp {score}")?;
            stdout.flush()?;
        } else if line == "go" || line.starts_with("go ") {
            handle_go(&mut pos, line, &mut stdout)?;
        } else if line == "d" {
            print_board(&pos, &mut stdout)?;
        } else if line == "quit" {
            break;
        }
    }
    Ok(())
}

/// Mirrors `parse_go_int` (engine/uci.c:19-27): `strstr` for `token`, then
/// `sscanf(found, "%*s %d")` — skip the token word, read the next int.
fn parse_go_int(line: &str, token: &str, default_value: i32) -> i32 {
    let Some(idx) = line.find(token) else {
        return default_value;
    };
    let found = &line[idx..];
    let mut words = found.split_whitespace();
    let _ = words.next(); // token
    match words.next().and_then(|w| w.parse::<i32>().ok()) {
        Some(v) => v,
        None => default_value,
    }
}

fn compute_time_ms(line: &str, side: Color) -> i32 {
    let movetime = parse_go_int(line, "movetime", 0);
    if movetime > 0 {
        return movetime;
    }
    let wtime = parse_go_int(line, "wtime", 0) as i64;
    let btime = parse_go_int(line, "btime", 0) as i64;
    let winc = parse_go_int(line, "winc", 0) as i64;
    let binc = parse_go_int(line, "binc", 0) as i64;
    compute_go_time_ms(ClockBudgetInput {
        wtime,
        btime,
        winc,
        binc,
        side,
    }) as i32
}

fn handle_go(pos: &mut EnginePosition, line: &str, stdout: &mut impl Write) -> io::Result<()> {
    let depth = parse_go_int(line, "depth", 5);
    let randomness = parse_go_int(line, "randomness", 0);
    let time_ms = compute_time_ms(line, pos.side_to_move);

    // Cap so a hostile/accidental `go depth N` (huge N) cannot overflow the
    // recursion stack (mirrors the C engine's MAX_PLY clamp).
    const MAX_GO_DEPTH: i32 = 128;
    let depth = depth.clamp(1, MAX_GO_DEPTH);
    let best = if time_ms > 0 {
        let max_depth = depth;
        search_timed(pos, max_depth, randomness, time_ms, |d, score_cp, mv| {
            let uci = engine_move_to_uci(&mv);
            // Mirrors emit_search_info (search.c:29-37): root static eval
            // + single-move PV — quirky but FROZEN for C parity.
            let _ = writeln!(stdout, "info depth {d} score cp {score_cp} pv {uci}");
            let _ = stdout.flush();
        })
    } else {
        search(pos, depth, randomness)
    };

    match best {
        Some(mv) => writeln!(stdout, "bestmove {}", engine_move_to_uci(&mv))?,
        None => writeln!(stdout, "bestmove 0000")?,
    }
    stdout.flush()
}

/// Mirrors the `d` command board dump (engine/uci.c:247-300).
fn print_board(pos: &EnginePosition, stdout: &mut impl Write) -> io::Result<()> {
    writeln!(stdout)?;
    writeln!(stdout, " +---+---+---+---+---+---+---+---+---+")?;
    for r in 0..9 {
        write!(stdout, "{}|", 9 - r)?;
        for c in 0..9 {
            let c_char = match pos.board.get(r, c) {
                None => '.',
                Some(p) => {
                    let mut sym = match p.kind {
                        PieceKind::Pawn => 'p',
                        PieceKind::Rook => 'r',
                        PieceKind::Knight => 'n',
                        PieceKind::Bishop => 'b',
                        PieceKind::Queen => 'q',
                        PieceKind::King => 'k',
                        PieceKind::Krishna => 'z',
                    };
                    if p.color == Color::White {
                        sym = sym.to_ascii_uppercase();
                    }
                    sym
                }
            };
            write!(stdout, " {c_char} |")?;
        }
        writeln!(stdout)?;
        writeln!(stdout, " +---+---+---+---+---+---+---+---+---+")?;
    }
    writeln!(stdout, "  a   b   c   d   e   f   g   h   i")?;
    writeln!(stdout)?;
    writeln!(
        stdout,
        "Side to move: {}",
        if pos.side_to_move == Color::White {
            "White"
        } else {
            "Black"
        }
    )?;
    writeln!(
        stdout,
        "Castling: {}{}{}{}",
        if pos.castling_rights & RIGHT_WK != 0 {
            'K'
        } else {
            '-'
        },
        if pos.castling_rights & RIGHT_WQ != 0 {
            'Q'
        } else {
            '-'
        },
        if pos.castling_rights & RIGHT_BK != 0 {
            'k'
        } else {
            '-'
        },
        if pos.castling_rights & RIGHT_BQ != 0 {
            'q'
        } else {
            '-'
        },
    )?;
    stdout.flush()
}
