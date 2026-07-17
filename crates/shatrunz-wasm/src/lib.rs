//! wasm-bindgen boundary over `shatrunz-core` (M5).
//! See docs/plans/PLAN_03_rust_port.md "WASM boundary".

use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

use shatrunz_core::clock_budget::{clock_fields_for_side, compute_go_time_ms};
use shatrunz_core::eval::hce::{
    eval_capture_pressure, eval_material_balance, eval_mobility, eval_pawn_structure,
    eval_piece_square, evaluate_position_white, persona_weights, Persona,
};
use shatrunz_core::game::Game;
use shatrunz_core::moves::{CastlingSide, Move, MoveTarget, Square};
use shatrunz_core::phase::{get_phase_for_game, Phase};
use shatrunz_core::piece::Color;
use shatrunz_core::rules;
use shatrunz_core::search::persona::{get_best_move, SearchConfig};
use shatrunz_core::uci::{legal_uci_moves, move_to_uci, parse_uci_move};

#[wasm_bindgen]
pub fn core_crate_name() -> String {
    shatrunz_core::CRATE_NAME.to_string()
}

// ── JSON shapes matching today's JS objects ───────────────────────────

#[derive(Serialize)]
struct JsPiece {
    #[serde(rename = "type")]
    kind: String,
    color: String,
}

#[derive(Serialize)]
struct JsSquare {
    r: usize,
    c: usize,
}

#[derive(Serialize, Deserialize)]
struct JsMoveTarget {
    r: usize,
    c: usize,
    #[serde(rename = "isCastling", default)]
    is_castling: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    side: Option<String>,
}

#[derive(Serialize)]
struct JsMove {
    from: JsSquare,
    to: JsMoveTarget,
}

#[derive(Serialize)]
struct JsStatus {
    over: bool,
    msg: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    winner: Option<String>,
}

fn color_char(c: Color) -> String {
    c.as_char().to_string()
}

fn parse_color(s: &str) -> Result<Color, JsValue> {
    match s {
        "w" | "white" | "White" => Ok(Color::White),
        "b" | "black" | "Black" => Ok(Color::Black),
        _ => Err(JsValue::from_str("invalid color")),
    }
}

fn parse_persona(s: &str) -> Result<Persona, JsValue> {
    match s {
        "material" => Ok(Persona::Material),
        "positional" => Ok(Persona::Positional),
        "aggressive" => Ok(Persona::Aggressive),
        _ => Err(JsValue::from_str("invalid persona")),
    }
}

fn phase_str(p: Phase) -> String {
    match p {
        Phase::Opening => "opening".into(),
        Phase::Middlegame => "middlegame".into(),
        Phase::Endgame => "endgame".into(),
    }
}

fn target_to_js(t: MoveTarget) -> JsMoveTarget {
    JsMoveTarget {
        r: t.r,
        c: t.c,
        is_castling: t.is_castling,
        side: t.castling_side.map(|s| match s {
            CastlingSide::King => "k".into(),
            CastlingSide::Queen => "q".into(),
        }),
    }
}

fn move_to_js(m: Move) -> JsMove {
    JsMove {
        from: JsSquare {
            r: m.from.r,
            c: m.from.c,
        },
        to: target_to_js(m.to),
    }
}

fn board_to_js(game: &Game) -> Result<JsValue, JsValue> {
    let mut rows: Vec<Vec<Option<JsPiece>>> = Vec::with_capacity(9);
    for r in 0..9 {
        let mut row = Vec::with_capacity(9);
        for c in 0..9 {
            row.push(game.board.get(r, c).map(|p| JsPiece {
                kind: p.kind.as_char().to_string(),
                color: color_char(p.color),
            }));
        }
        rows.push(row);
    }
    to_value(&rows).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Thin Wasm wrapper around `Game` (JS persona / position-only castling).
#[wasm_bindgen]
pub struct WasmGame {
    inner: Game,
}

#[wasm_bindgen]
impl WasmGame {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmGame {
        WasmGame {
            inner: Game::new(),
        }
    }

    /// Replay UCI moves from startpos (same as `position startpos moves …`).
    #[wasm_bindgen(js_name = fromUciMoves)]
    pub fn from_uci_moves(moves: JsValue) -> Result<WasmGame, JsValue> {
        let tokens: Vec<String> = serde_wasm_bindgen::from_value(moves)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut g = Game::new();
        for tok in tokens {
            let (from, to) = parse_uci_move(&tok)
                .ok_or_else(|| JsValue::from_str(&format!("bad uci: {tok}")))?;
            if !g.execute_move(from, to) {
                return Err(JsValue::from_str(&format!("illegal: {tok}")));
            }
        }
        Ok(WasmGame { inner: g })
    }

    /// 9×9 board as JS nested arrays of `{type,color}` / `null`.
    pub fn board(&self) -> Result<JsValue, JsValue> {
        board_to_js(&self.inner)
    }

    /// Side to move: `"w"` / `"b"`.
    pub fn turn(&self) -> String {
        color_char(self.inner.turn)
    }

    #[wasm_bindgen(js_name = legalMovesFor)]
    pub fn legal_moves_for(&self, r: usize, c: usize) -> Result<JsValue, JsValue> {
        let targets = rules::get_legal_moves(&self.inner.board, r, c, true);
        let js: Vec<JsMoveTarget> = targets.into_iter().map(target_to_js).collect();
        to_value(&js).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = allLegalMoves)]
    pub fn all_legal_moves(&self) -> Result<JsValue, JsValue> {
        let moves = self.inner.legal_moves(self.inner.turn);
        let js: Vec<JsMove> = moves.into_iter().map(move_to_js).collect();
        to_value(&js).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = allLegalUci)]
    pub fn all_legal_uci(&self) -> Result<JsValue, JsValue> {
        let uci = legal_uci_moves(&self.inner, self.inner.turn);
        to_value(&uci).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = executeMove)]
    pub fn execute_move(&mut self, from_r: usize, from_c: usize, to: JsValue) -> Result<bool, JsValue> {
        let t: JsMoveTarget =
            serde_wasm_bindgen::from_value(to).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let side = match t.side.as_deref() {
            Some("k") => Some(CastlingSide::King),
            Some("q") => Some(CastlingSide::Queen),
            _ => None,
        };
        let target = MoveTarget {
            r: t.r,
            c: t.c,
            is_castling: t.is_castling,
            castling_side: side,
        };
        Ok(self
            .inner
            .execute_move(Square { r: from_r, c: from_c }, target))
    }

    #[wasm_bindgen(js_name = executeUci)]
    pub fn execute_uci(&mut self, uci: &str) -> bool {
        let Some((from, to)) = parse_uci_move(uci) else {
            return false;
        };
        self.inner.execute_move(from, to)
    }

    #[wasm_bindgen(js_name = undoLastMove)]
    pub fn undo_last_move(&mut self) -> bool {
        self.inner.undo_last_move()
    }

    #[wasm_bindgen(js_name = checkStatus)]
    pub fn check_status(&self) -> Result<JsValue, JsValue> {
        let s = self.inner.check_status();
        let js = JsStatus {
            over: s.over,
            msg: s.msg,
            winner: s.winner.map(color_char),
        };
        to_value(&js).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = positionKey)]
    pub fn position_key(&self) -> String {
        self.inner.position_key()
    }

    #[wasm_bindgen(js_name = getScore)]
    pub fn get_score(&self) -> i32 {
        self.inner.get_score()
    }

    #[wasm_bindgen(js_name = isKingInCheck)]
    pub fn is_king_in_check(&self, color: &str) -> Result<bool, JsValue> {
        let c = parse_color(color)?;
        Ok(rules::is_king_in_check(&self.inner.board, c))
    }

    pub fn phase(&self) -> String {
        phase_str(get_phase_for_game(&self.inner))
    }

    /// ASCII board dump (MCP / debug).
    pub fn ascii(&self) -> String {
        self.inner.board.to_ascii()
    }
}

impl Default for WasmGame {
    fn default() -> Self {
        Self::new()
    }
}

// ── Free functions ────────────────────────────────────────────────────

#[wasm_bindgen(js_name = parseUciMove)]
pub fn wasm_parse_uci_move(uci: &str) -> Result<JsValue, JsValue> {
    let (from, to) = parse_uci_move(uci).ok_or_else(|| JsValue::from_str("null"))?;
    #[derive(Serialize)]
    struct Out {
        from: JsSquare,
        to: JsMoveTarget,
    }
    to_value(&Out {
        from: JsSquare {
            r: from.r,
            c: from.c,
        },
        to: target_to_js(to),
    })
    .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen(js_name = moveToUci)]
pub fn wasm_move_to_uci(game: &WasmGame, from_r: usize, from_c: usize, to: JsValue) -> Result<String, JsValue> {
    let t: JsMoveTarget =
        serde_wasm_bindgen::from_value(to).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let m = Move {
        from: Square { r: from_r, c: from_c },
        to: MoveTarget {
            r: t.r,
            c: t.c,
            is_castling: t.is_castling,
            castling_side: match t.side.as_deref() {
                Some("k") => Some(CastlingSide::King),
                Some("q") => Some(CastlingSide::Queen),
                _ => None,
            },
        },
    };
    Ok(move_to_uci(&game.inner.board, m))
}

#[wasm_bindgen(js_name = evaluatePositionWhite)]
pub fn wasm_evaluate_position_white(game: &WasmGame, persona: &str) -> Result<i32, JsValue> {
    let p = parse_persona(persona)?;
    Ok(evaluate_position_white(&game.inner.board, p))
}

#[wasm_bindgen(js_name = evalBreakdown)]
pub fn wasm_eval_breakdown(game: &WasmGame, persona: &str) -> Result<JsValue, JsValue> {
    let p = parse_persona(persona)?;
    let phase = get_phase_for_game(&game.inner);
    let w = persona_weights(p);
    let material = eval_material_balance(&game.inner.board);
    let pst = eval_piece_square(&game.inner.board, phase);
    let mobility = eval_mobility(&game.inner.board);
    let pawns = eval_pawn_structure(&game.inner.board);
    let capture = eval_capture_pressure(&game.inner.board);
    let total = evaluate_position_white(&game.inner.board, p);
    #[derive(Serialize)]
    struct Breakdown {
        total: i32,
        material: i32,
        pst: i32,
        mobility: i32,
        pawns: i32,
        capture: f64,
        phase: String,
        #[serde(rename = "personaWeights")]
        persona_weights: HashMap<&'static str, f64>,
    }
    let mut pw = HashMap::new();
    pw.insert("material", w.material);
    pw.insert("pst", w.pst);
    pw.insert("mobility", w.mobility);
    pw.insert("pawns", w.pawns);
    pw.insert("tempo", w.tempo);
    if let Some(c) = w.capture {
        pw.insert("capture", c);
    }
    to_value(&Breakdown {
        total,
        material,
        pst,
        mobility,
        pawns,
        capture,
        phase: phase_str(phase),
        persona_weights: pw,
    })
    .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen(js_name = clockBudgetMs)]
pub fn wasm_clock_budget_ms(
    white_ms: f64,
    black_ms: f64,
    side: &str,
    increment_ms: f64,
) -> Result<i64, JsValue> {
    let c = parse_color(side)?;
    let input = clock_fields_for_side(white_ms as i64, black_ms as i64, c, increment_ms as i64);
    Ok(compute_go_time_ms(input))
}

/// Persona search. `opts` JSON: `{color, persona, depth, budgetMs?, rootBonuses?}`.
/// `rootBonuses` maps UCI → number (brain/policy bonuses from JS).
#[wasm_bindgen(js_name = searchBestMove)]
pub fn wasm_search_best_move(game: &mut WasmGame, opts: JsValue) -> Result<JsValue, JsValue> {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Opts {
        color: String,
        persona: String,
        depth: u32,
        #[serde(default)]
        budget_ms: Option<f64>,
        #[serde(default)]
        root_bonuses: Option<HashMap<String, f64>>,
    }
    let opts: Opts =
        serde_wasm_bindgen::from_value(opts).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let color = parse_color(&opts.color)?;
    let persona = parse_persona(&opts.persona)?;
    let deadline = opts
        .budget_ms
        .filter(|&ms| ms > 0.0)
        .map(|ms| Instant::now() + Duration::from_millis(ms as u64));
    let cfg = SearchConfig {
        persona,
        add_randomness: false,
        deadline,
    };
    let bonuses = opts.root_bonuses.unwrap_or_default();
    let board = game.inner.board.clone();
    let result = get_best_move(&mut game.inner, color, opts.depth, &cfg, &|m| {
        let uci = move_to_uci(&board, m);
        *bonuses.get(&uci).unwrap_or(&0.0)
    });
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Out {
        uci: Option<String>,
        best_score: f64,
        second_score: f64,
        depth_reached: u32,
    }
    let uci = result
        .best_move
        .map(|m| move_to_uci(&game.inner.board, m));
    to_value(&Out {
        uci,
        best_score: result.best_score,
        second_score: result.second_score,
        depth_reached: result.depth_reached,
    })
    .map_err(|e| JsValue::from_str(&e.to_string()))
}
