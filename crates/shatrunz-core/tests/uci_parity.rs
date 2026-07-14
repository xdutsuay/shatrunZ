//! Parity gate for `uci::parse_uci_move`/`move_to_uci` against the JS
//! oracle (`frontend/shared/uci.js`). Regenerate the fixture with:
//!
//! ```sh
//! node tools/js/uci_dump.mjs > crates/shatrunz-core/tests/fixtures/uci_fixture.json
//! ```

use serde::Deserialize;
use shatrunz_core::board::Board;
use shatrunz_core::moves::{Move, MoveTarget, Square};
use shatrunz_core::piece::{Color, Piece, PieceKind};
use shatrunz_core::uci::{move_to_uci, parse_uci_move};

#[derive(Debug, Deserialize)]
struct Fixture {
    #[serde(rename = "parseCases")]
    parse_cases: Vec<ParseCase>,
    #[serde(rename = "moveCases")]
    move_cases: Vec<MoveCase>,
}

#[derive(Debug, Deserialize)]
struct ParseCase {
    uci: String,
    parsed: FixtureMove,
}

#[derive(Debug, Deserialize)]
struct FixtureMove {
    from: FixtureSquare,
    to: FixtureSquare,
}

#[derive(Debug, Deserialize)]
struct FixtureSquare {
    r: usize,
    c: usize,
}

#[derive(Debug, Deserialize)]
struct MoveCase {
    from: FixtureSquare,
    to: FixtureSquare,
    #[serde(rename = "type")]
    piece_type: String,
    uci: String,
}

fn load_fixture() -> Fixture {
    let raw = include_str!("fixtures/uci_fixture.json");
    serde_json::from_str(raw).expect("uci_fixture.json must parse")
}

#[test]
fn parse_uci_move_matches_js_oracle() {
    for case in load_fixture().parse_cases {
        let (from, to) = parse_uci_move(&case.uci).unwrap_or_else(|| panic!("{}: failed to parse", case.uci));
        assert_eq!(from, Square { r: case.parsed.from.r, c: case.parsed.from.c }, "{}: from", case.uci);
        assert_eq!(
            to,
            MoveTarget::plain(case.parsed.to.r, case.parsed.to.c),
            "{}: to",
            case.uci
        );
    }
}

fn piece_kind_from_char(c: &str) -> PieceKind {
    match c {
        "p" => PieceKind::Pawn,
        "r" => PieceKind::Rook,
        "n" => PieceKind::Knight,
        "b" => PieceKind::Bishop,
        "q" => PieceKind::Queen,
        "k" => PieceKind::King,
        "z" => PieceKind::Krishna,
        other => panic!("unknown piece type {other}"),
    }
}

#[test]
fn move_to_uci_matches_js_oracle() {
    for case in load_fixture().move_cases {
        let mut board = Board::empty();
        let piece = Piece { color: Color::White, kind: piece_kind_from_char(&case.piece_type) };
        board.set(case.from.r, case.from.c, Some(piece));
        let m = Move {
            from: Square { r: case.from.r, c: case.from.c },
            to: MoveTarget::plain(case.to.r, case.to.c),
        };
        assert_eq!(move_to_uci(&board, m), case.uci, "from={:?} to={:?}", case.from, case.to);
    }
}
