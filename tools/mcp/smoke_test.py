#!/usr/bin/env python3
"""
End-to-end smoke test for shatrunz-mcp: drives the built binary over raw
JSON-RPC 2.0 stdio (initialize -> notifications/initialized -> tools/list
-> tools/call ...), the same protocol a real MCP client speaks. This is
the M3 acceptance check from docs/plans/PLAN_03_rust_port.md ("smoke via
a self-play game + perft through the MCP").

Usage:
    cargo build -p shatrunz-mcp
    python3 tools/mcp/smoke_test.py [path/to/shatrunz-mcp binary]
"""
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BIN = REPO_ROOT / "target" / "debug" / "shatrunz-mcp"


def main():
    bin_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_BIN
    if not bin_path.exists():
        print(f"error: {bin_path} not built — run `cargo build -p shatrunz-mcp` first", file=sys.stderr)
        sys.exit(1)

    proc = subprocess.Popen(
        [str(bin_path)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    next_id = 0

    def send(method, params=None, notification=False):
        nonlocal next_id
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        if not notification:
            next_id += 1
            msg["id"] = next_id
        proc.stdin.write(json.dumps(msg) + "\n")
        proc.stdin.flush()
        if notification:
            return None
        line = proc.stdout.readline()
        return json.loads(line)

    def call_tool(name, args):
        resp = send("tools/call", {"name": name, "arguments": args})
        if "error" in resp:
            raise RuntimeError(f"{name} error: {resp['error']}")
        return json.loads(resp["result"]["content"][0]["text"])

    try:
        r = send("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "smoke", "version": "0.0.0"},
        })
        print("initialize ok:", r["result"]["serverInfo"])
        send("notifications/initialized", notification=True)

        r = send("tools/list")
        names = sorted(t["name"] for t in r["result"]["tools"])
        print("tools:", names)
        expected = {
            "engine_move", "evaluate", "get_state", "legal_moves",
            "make_move", "new_game", "perft", "self_play",
        }
        assert expected.issubset(set(names)), f"missing tools: {expected - set(names)}"

        state = call_tool("new_game", {"moves": []})
        print("new_game:", state["game_id"], state["turn"], state["over"])
        game_id = state["game_id"]

        lm = call_tool("legal_moves", {"game_id": game_id})["moves"]
        print("legal_moves count:", len(lm))
        assert len(lm) == 22, f"expected 22 legal moves at startpos, got {len(lm)}"

        mm = call_tool("make_move", {"game_id": game_id, "uci": lm[0]})
        print("make_move:", mm["ok"], mm["state"]["turn"] if mm["ok"] else mm["error"])
        assert mm["ok"]

        bad = call_tool("make_move", {"game_id": game_id, "uci": "a1a1"})
        print("illegal move rejected:", bad["ok"] is False, bad["error"])
        assert bad["ok"] is False

        pf = call_tool("perft", {"game_id": game_id, "depth": 2})
        print("perft depth2:", pf["nodes"])

        ev = call_tool("evaluate", {"game_id": game_id, "persona": "aggressive"})
        print("evaluate:", ev)

        em = call_tool("engine_move", {"game_id": game_id, "persona": "material", "depth": 2})
        print("engine_move:", em)

        sp = call_tool("self_play", {
            "white_persona": "material", "black_persona": "positional",
            "white_depth": 2, "black_depth": 2, "max_plies": 20,
        })
        print("self_play:", sp["result"], "plies=", sp["plies"], "moves[:5]=", sp["moves"][:5])

        print("ALL OK")
    finally:
        proc.stdin.close()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        err = proc.stderr.read()
        if err.strip():
            print("--- stderr ---", file=sys.stderr)
            print(err, file=sys.stderr)


if __name__ == "__main__":
    main()
