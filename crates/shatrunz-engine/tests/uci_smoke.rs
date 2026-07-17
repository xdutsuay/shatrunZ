//! Tiny smoke test for the Rust UCI binary (`shatrunz_engine`).
//! Does not touch the C oracle at `engine/shatrunz_engine`.

use std::io::Write;
use std::process::{Command, Stdio};

#[test]
fn uci_startpos_legal_eval_go_depth1() {
    let bin = env!("CARGO_BIN_EXE_shatrunz_engine");
    let mut child = Command::new(bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn shatrunz_engine");

    {
        let stdin = child.stdin.as_mut().expect("stdin");
        write!(
            stdin,
            "uci\nisready\nposition startpos\nlegal\neval\ngo depth 1\nquit\n"
        )
        .expect("write stdin");
    }

    let output = child.wait_with_output().expect("wait");
    assert!(
        output.status.success(),
        "engine exited {:?}; stderr={}",
        output.status.code(),
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("uciok"), "missing uciok:\n{stdout}");
    assert!(stdout.contains("readyok"), "missing readyok:\n{stdout}");
    assert!(
        stdout.contains("legalmoves"),
        "missing legalmoves:\n{stdout}"
    );
    assert!(
        stdout.lines().any(|l| l.starts_with("bestmove ")),
        "missing bestmove:\n{stdout}"
    );
}

#[test]
fn uci_position_fen_startpos_legal() {
    let bin = env!("CARGO_BIN_EXE_shatrunz_engine");
    let fen = "rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - - 0 1";
    let mut child = Command::new(bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn shatrunz_engine");

    {
        let stdin = child.stdin.as_mut().expect("stdin");
        write!(
            stdin,
            "uci\nisready\nposition fen {fen}\nlegal\nquit\n"
        )
        .expect("write stdin");
    }

    let output = child.wait_with_output().expect("wait");
    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("legalmoves a2a3"),
        "fen position should yield startpos legal moves:\n{stdout}"
    );
}
