//! Faithful port of `frontend/shared/game_phase.js`. Used by both eval
//! (PST table selection) and, later, search/persona bonuses.

use crate::board::{Board, BOARD_SIZE};
use crate::game::Game;
use crate::piece::PieceKind;
use crate::rules;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Phase {
    Opening,
    Middlegame,
    Endgame,
}

/// Krishna is immobile for capture logic but occupies a square — excluded
/// from "material" count. Mirrors `countNonKrishnaPieces` (game_phase.js:13-22).
pub fn count_non_krishna_pieces(board: &Board) -> u32 {
    let mut n = 0;
    for r in 0..BOARD_SIZE {
        for c in 0..BOARD_SIZE {
            if let Some(p) = board.get(r, c) {
                if p.kind != PieceKind::Krishna {
                    n += 1;
                }
            }
        }
    }
    n
}

#[derive(Debug, Clone, Copy)]
pub struct PhaseOpts {
    pub opening_min_pieces: u32,
    pub endgame_max_pieces: u32,
}

impl Default for PhaseOpts {
    /// Mirrors the `opts.openingMinPieces ?? 26` / `opts.endgameMaxPieces ?? 7`
    /// defaults (game_phase.js:25-26).
    fn default() -> Self {
        PhaseOpts {
            opening_min_pieces: 26,
            endgame_max_pieces: 7,
        }
    }
}

/// Mirrors `getPhase` (game_phase.js:24-31).
pub fn get_phase_with_opts(board: &Board, opts: PhaseOpts) -> Phase {
    let n = count_non_krishna_pieces(board);
    if n >= opts.opening_min_pieces {
        Phase::Opening
    } else if n <= opts.endgame_max_pieces {
        Phase::Endgame
    } else {
        Phase::Middlegame
    }
}

pub fn get_phase(board: &Board) -> Phase {
    get_phase_with_opts(board, PhaseOpts::default())
}

/// `getPhase` (game_phase.js:24-31) takes the whole `Game`, not just its
/// board — this is the direct equivalent; `get_phase` above matches
/// eval_core.js's separate `inferPhase(board)`, which is the same
/// board-only computation with the same 26/7 defaults.
pub fn get_phase_for_game(game: &Game) -> Phase {
    get_phase(&game.board)
}

/// Mirrors `endgameDepthBonus` (opening_book.js:19-21): +1 search depth
/// once in the endgame phase. Deterministic (no brain dependency), unlike
/// `openingBookBonus` in the same file, which needs brain memory and stays
/// JS-side per docs/RUST_PORT.md's frontend module disposition.
pub fn endgame_depth_bonus(game: &Game) -> u32 {
    if get_phase_for_game(game) == Phase::Endgame {
        1
    } else {
        0
    }
}

/// Legal-move count for side to move (proxy for branching factor). Mirrors
/// `estimateBranchingFactor` (game_phase.js:34-36).
pub fn estimate_branching_factor(game: &Game) -> usize {
    rules::get_all_legal_moves(&game.board, game.turn).len()
}

#[derive(Debug, Clone, Copy)]
pub struct PhaseSnapshot {
    pub phase: Phase,
    pub non_krishna_pieces: u32,
    pub legal_moves: usize,
}

/// Mirrors `phaseSnapshot` (game_phase.js:38-46).
pub fn phase_snapshot(game: &Game) -> PhaseSnapshot {
    PhaseSnapshot {
        phase: get_phase(&game.board),
        non_krishna_pieces: count_non_krishna_pieces(&game.board),
        legal_moves: estimate_branching_factor(game),
    }
}
