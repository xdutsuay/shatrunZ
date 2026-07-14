//! Parity gate for `clock_budget::compute_go_time_ms` against the JS
//! oracle (`frontend/shared/clock_budget.js`). Not independently checked
//! against the C engine binary (its `compute_go_time_ms` in engine/uci.c
//! is a static function, not directly reachable via UCI) — instead the
//! Rust implementation uses the exact same integer formula
//! (`(remaining*2)/5` for the 40% cap) that engine/uci.c's source uses
//! literally, and this identity was spot-checked by hand against JS's
//! `Math.floor(remaining * 0.4)` for representative integers (see
//! clock_budget.rs's doc comment). Regenerate the fixture with:
//!
//! ```sh
//! node tools/js/clock_budget_dump.mjs > crates/shatrunz-core/tests/fixtures/clock_budget_fixture.json
//! ```

use serde::Deserialize;
use shatrunz_core::clock_budget::{compute_go_time_ms, ClockBudgetInput};
use shatrunz_core::piece::Color;

#[derive(Debug, Deserialize)]
struct Case {
    input: Input,
    #[serde(rename = "budgetMs")]
    budget_ms: i64,
}

#[derive(Debug, Deserialize)]
struct Input {
    wtime: i64,
    btime: i64,
    winc: i64,
    binc: i64,
    side: String,
}

fn load_fixture() -> Vec<Case> {
    let raw = include_str!("fixtures/clock_budget_fixture.json");
    serde_json::from_str(raw).expect("clock_budget_fixture.json must parse")
}

#[test]
fn compute_go_time_ms_matches_js_oracle() {
    for case in load_fixture() {
        let side = if case.input.side == "w" { Color::White } else { Color::Black };
        let got = compute_go_time_ms(ClockBudgetInput {
            wtime: case.input.wtime,
            btime: case.input.btime,
            winc: case.input.winc,
            binc: case.input.binc,
            side,
        });
        assert_eq!(got, case.budget_ms, "input {:?}", case.input);
    }
}
