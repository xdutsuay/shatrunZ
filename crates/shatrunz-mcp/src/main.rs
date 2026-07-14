//! ShatrunZ MCP: an MCP server (stdio JSON-RPC 2.0, via `rmcp`) linking
//! `shatrunz-core` in-process — no UCI round-trip — so it can expose eval
//! breakdowns, search info, and perft that plain UCI can't. See
//! docs/plans/PLAN_03_rust_port.md "ShatrunZ MCP" for the full tool list
//! and the flywheel rationale (self-play/perft become the fixture and
//! change-verification source of record for later sessions).
//!
//! **This session's slice** (see docs/RUST_PORT.md "ShatrunZ MCP" for what
//! isn't here yet): `new_game`/`get_state`/`legal_moves`/`make_move`
//! (the rule-bug-detector core), `perft` (correctness oracle), `evaluate`
//! (eval-critique surface), `engine_move`/`self_play` (persona search
//! only — the C engine's search is deferred to M4, see
//! search::persona's module doc). Deferred: `analyze` (multipv),
//! `tournament`, `set_persona_weights`/`reset_weights` (persona weights
//! are a hardcoded fn right now, not overridable), `import_pgn`/
//! `export_pgn` (needs a pgn module, not ported), FEN in/out (no fen.rs
//! yet — `ascii` + `position_key` stand in for now), and the optional
//! `data/mcp/` snapshot.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{Implementation, ServerCapabilities, ServerInfo};
use rmcp::{tool, tool_handler, tool_router, ServerHandler, ServiceExt};
use rmcp::Json;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use shatrunz_core::eval::hce::{
    eval_capture_pressure, eval_material_balance, eval_mobility, eval_pawn_structure,
    eval_piece_square, evaluate_position_white, Persona,
};
use shatrunz_core::game::Game;
use shatrunz_core::moves::Square;
use shatrunz_core::phase::get_phase;
use shatrunz_core::piece::Color;
use shatrunz_core::search::persona::{get_best_move, SearchConfig};
use shatrunz_core::uci::{legal_uci_moves, move_to_uci, parse_uci_move};

fn persona_from_str(s: &str) -> Persona {
    match s {
        "positional" => Persona::Positional,
        "aggressive" => Persona::Aggressive,
        _ => Persona::Material,
    }
}

fn color_to_str(c: Color) -> &'static str {
    match c {
        Color::White => "w",
        Color::Black => "b",
    }
}

/// Parses an algebraic square like `"e2"` (file a-i, rank = 9-row) —
/// same convention as `uci::parse_uci_move`, just half a move.
fn parse_square(s: &str) -> Option<Square> {
    let bytes = s.as_bytes();
    if bytes.len() < 2 {
        return None;
    }
    let file = b"abcdefghi".iter().position(|&f| f == bytes[0])?;
    let rank_digit = (bytes[1] as char).to_digit(10)?;
    let r = 9i32 - rank_digit as i32;
    if !(0..9).contains(&r) {
        return None;
    }
    Some(Square { r: r as usize, c: file })
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
struct GameStateResp {
    game_id: u64,
    ascii: String,
    position_key: String,
    turn: String,
    over: bool,
    status_msg: String,
    winner: Option<String>,
    legal_uci: Vec<String>,
}

fn game_state_resp(game_id: u64, game: &Game) -> GameStateResp {
    let status = game.check_status();
    GameStateResp {
        game_id,
        ascii: game.board.to_ascii(),
        position_key: game.position_key(),
        turn: color_to_str(game.turn).to_string(),
        over: status.over,
        status_msg: status.msg,
        winner: status.winner.map(color_to_str).map(str::to_string),
        legal_uci: legal_uci_moves(game, game.turn),
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
struct NewGameRequest {
    /// UCI moves to replay from startpos (empty/omitted = startpos itself).
    #[serde(default)]
    moves: Vec<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GameIdRequest {
    game_id: u64,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct LegalMovesRequest {
    game_id: u64,
    /// Optional algebraic square (e.g. "e2") to restrict to one piece's moves.
    square: Option<String>,
}

#[derive(Debug, Serialize, JsonSchema)]
struct LegalMovesResp {
    moves: Vec<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct MakeMoveRequest {
    game_id: u64,
    uci: String,
}

#[derive(Debug, Serialize, JsonSchema)]
struct MakeMoveResp {
    ok: bool,
    state: Option<GameStateResp>,
    error: Option<String>,
    legal_uci: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct PerftRequest {
    game_id: u64,
    depth: u32,
}

#[derive(Debug, Serialize, JsonSchema)]
struct PerftResp {
    nodes: u64,
}

fn perft(game: &mut Game, depth: u32) -> u64 {
    if depth == 0 {
        return 1;
    }
    let moves = game.legal_moves(game.turn);
    let mut nodes = 0u64;
    for m in moves {
        game.execute_move(m.from, m.to);
        nodes += perft(game, depth - 1);
        game.undo_last_move();
    }
    nodes
}

#[derive(Debug, Deserialize, JsonSchema)]
struct EvaluateRequest {
    game_id: u64,
    #[serde(default = "default_persona")]
    persona: String,
}

fn default_persona() -> String {
    "material".to_string()
}

#[derive(Debug, Serialize, JsonSchema)]
struct EvaluateResp {
    total: i32,
    material: i32,
    pst: i32,
    mobility: i32,
    pawns: i32,
    capture: f64,
    phase: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct EngineMoveRequest {
    game_id: u64,
    #[serde(default = "default_persona")]
    persona: String,
    #[serde(default = "default_depth")]
    depth: u32,
}

fn default_depth() -> u32 {
    3
}

#[derive(Debug, Serialize, JsonSchema)]
struct EngineMoveResp {
    uci: Option<String>,
    score_cp: f64,
    depth_reached: u32,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct SelfPlayRequest {
    #[serde(default = "default_persona")]
    white_persona: String,
    #[serde(default = "default_persona")]
    black_persona: String,
    #[serde(default = "default_depth")]
    white_depth: u32,
    #[serde(default = "default_depth")]
    black_depth: u32,
    #[serde(default = "default_max_plies")]
    max_plies: u32,
}

fn default_max_plies() -> u32 {
    120
}

#[derive(Debug, Serialize, JsonSchema)]
struct SelfPlayResp {
    result: String,
    plies: u32,
    moves: Vec<String>,
    position_keys: Vec<String>,
}

#[derive(Clone)]
struct Server {
    games: std::sync::Arc<Mutex<HashMap<u64, Game>>>,
    next_id: std::sync::Arc<AtomicU64>,
    // Read by #[tool_handler]'s generated call_tool/list_tools, which
    // dead-code analysis doesn't see as a "use" of the field.
    #[allow(dead_code)]
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl Server {
    fn new() -> Self {
        Server {
            games: std::sync::Arc::new(Mutex::new(HashMap::new())),
            next_id: std::sync::Arc::new(AtomicU64::new(1)),
            tool_router: Self::tool_router(),
        }
    }

    #[tool(description = "Start a new game from startpos, optionally replaying UCI moves. Returns the game state (rule-bug detector: a bad `moves` list surfaces as an error here).")]
    async fn new_game(&self, params: Parameters<NewGameRequest>) -> Result<Json<GameStateResp>, String> {
        let mut game = Game::new();
        for uci in &params.0.moves {
            let (from, to) = parse_uci_move(uci).ok_or_else(|| format!("bad uci move: {uci}"))?;
            if !game.execute_move(from, to) {
                return Err(format!("illegal move: {uci}"));
            }
        }
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let resp = game_state_resp(id, &game);
        self.games.lock().unwrap().insert(id, game);
        Ok(Json(resp))
    }

    #[tool(description = "Get the current state of a game by id.")]
    async fn get_state(&self, params: Parameters<GameIdRequest>) -> Result<Json<GameStateResp>, String> {
        let games = self.games.lock().unwrap();
        let game = games.get(&params.0.game_id).ok_or("unknown game_id")?;
        Ok(Json(game_state_resp(params.0.game_id, game)))
    }

    #[tool(description = "List legal moves (UCI) for a game, optionally restricted to one square.")]
    async fn legal_moves(&self, params: Parameters<LegalMovesRequest>) -> Result<Json<LegalMovesResp>, String> {
        let games = self.games.lock().unwrap();
        let game = games.get(&params.0.game_id).ok_or("unknown game_id")?;
        let all = game.legal_moves(game.turn);
        let moves: Vec<String> = match &params.0.square {
            None => all.into_iter().map(|m| move_to_uci(&game.board, m)).collect(),
            Some(sq) => {
                let from = parse_square(sq).ok_or_else(|| format!("bad square: {sq}"))?;
                all.into_iter()
                    .filter(|m| m.from == from)
                    .map(|m| move_to_uci(&game.board, m))
                    .collect()
            }
        };
        Ok(Json(LegalMovesResp { moves }))
    }

    #[tool(description = "Play a UCI move in a game. Illegal moves return {ok:false, error, legal_uci} instead of mutating state — the rule-bug detector.")]
    async fn make_move(&self, params: Parameters<MakeMoveRequest>) -> Result<Json<MakeMoveResp>, String> {
        let mut games = self.games.lock().unwrap();
        let game = games.get_mut(&params.0.game_id).ok_or("unknown game_id")?;

        let parsed = parse_uci_move(&params.0.uci);
        let legal = game.legal_moves(game.turn);
        let is_legal = match parsed {
            Some((from, to)) => legal.iter().any(|m| m.from == from && m.to.r == to.r && m.to.c == to.c),
            None => false,
        };

        if !is_legal {
            return Ok(Json(MakeMoveResp {
                ok: false,
                state: None,
                error: Some(format!("illegal move: {}", params.0.uci)),
                legal_uci: Some(legal.into_iter().map(|m| move_to_uci(&game.board, m)).collect()),
            }));
        }

        let (from, to) = parsed.unwrap();
        // Recover the exact MoveTarget (with castling flag) from the legal list,
        // since parse_uci_move alone can't know a move is a castle.
        let full = legal.into_iter().find(|m| m.from == from && m.to.r == to.r && m.to.c == to.c).unwrap();
        game.execute_move(full.from, full.to);
        Ok(Json(MakeMoveResp {
            ok: true,
            state: Some(game_state_resp(params.0.game_id, game)),
            error: None,
            legal_uci: None,
        }))
    }

    #[tool(description = "Perft (node count at a fixed depth) from a game's current position — a correctness oracle for move generation.")]
    async fn perft(&self, params: Parameters<PerftRequest>) -> Result<Json<PerftResp>, String> {
        let mut games = self.games.lock().unwrap();
        let game = games.get_mut(&params.0.game_id).ok_or("unknown game_id")?;
        Ok(Json(PerftResp { nodes: perft(game, params.0.depth) }))
    }

    #[tool(description = "Evaluate a game's position with a persona's HCE breakdown (material/pst/mobility/pawns/capture/total) — an eval-critique surface.")]
    async fn evaluate(&self, params: Parameters<EvaluateRequest>) -> Result<Json<EvaluateResp>, String> {
        let games = self.games.lock().unwrap();
        let game = games.get(&params.0.game_id).ok_or("unknown game_id")?;
        let persona = persona_from_str(&params.0.persona);
        let phase = get_phase(&game.board);
        Ok(Json(EvaluateResp {
            total: evaluate_position_white(&game.board, persona),
            material: eval_material_balance(&game.board),
            pst: eval_piece_square(&game.board, phase),
            mobility: eval_mobility(&game.board),
            pawns: eval_pawn_structure(&game.board),
            capture: eval_capture_pressure(&game.board),
            phase: format!("{phase:?}"),
        }))
    }

    #[tool(description = "Ask the persona search engine for its best move at a fixed depth (no time budget, no randomness/bonuses).")]
    async fn engine_move(&self, params: Parameters<EngineMoveRequest>) -> Result<Json<EngineMoveResp>, String> {
        let mut games = self.games.lock().unwrap();
        let game = games.get_mut(&params.0.game_id).ok_or("unknown game_id")?;
        let persona = persona_from_str(&params.0.persona);
        let turn = game.turn;
        let cfg = SearchConfig { persona, add_randomness: false, deadline: None };
        let result = get_best_move(game, turn, params.0.depth, &cfg, &|_m| 0.0);
        let uci = result.best_move.map(|m| move_to_uci(&game.board, m));
        Ok(Json(EngineMoveResp {
            uci,
            score_cp: result.best_score,
            depth_reached: result.depth_reached,
        }))
    }

    #[tool(description = "Self-play a full game between two persona/depth configs (no time budget). Generates fixture-quality data: result, move list, and position_key trace.")]
    async fn self_play(&self, params: Parameters<SelfPlayRequest>) -> Result<Json<SelfPlayResp>, String> {
        let mut game = Game::new();
        let white_persona = persona_from_str(&params.0.white_persona);
        let black_persona = persona_from_str(&params.0.black_persona);
        let mut moves = Vec::new();
        let mut position_keys = vec![game.position_key()];
        let mut plies = 0u32;
        let result;

        loop {
            let status = game.check_status();
            if status.over {
                result = status.msg;
                break;
            }
            if plies >= params.0.max_plies {
                result = "Adjudicated: max_plies reached".to_string();
                break;
            }

            let (persona, depth) = if game.turn == Color::White {
                (white_persona, params.0.white_depth)
            } else {
                (black_persona, params.0.black_depth)
            };
            let cfg = SearchConfig { persona, add_randomness: false, deadline: None };
            let turn = game.turn;
            let search_result = get_best_move(&mut game, turn, depth, &cfg, &|_m| 0.0);
            let Some(best) = search_result.best_move else {
                result = "no legal move found despite status.over == false (bug)".to_string();
                break;
            };
            moves.push(move_to_uci(&game.board, best));
            game.execute_move(best.from, best.to);
            position_keys.push(game.position_key());
            plies += 1;
        }

        Ok(Json(SelfPlayResp { result, plies, moves, position_keys }))
    }
}

#[tool_handler]
impl ServerHandler for Server {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("shatrunz-mcp", env!("CARGO_PKG_VERSION")))
            .with_instructions(
                "ShatrunZ MCP: play/inspect/self-play the 9x9 Krishna chess variant \
                 in-process (no UCI round-trip). Start with new_game, then use \
                 make_move/legal_moves/get_state to play, perft to sanity-check \
                 rules, evaluate for an HCE breakdown, and engine_move/self_play \
                 to drive the persona search.",
            )
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let server = Server::new().serve(rmcp::transport::stdio()).await?;
    server.waiting().await?;
    Ok(())
}
