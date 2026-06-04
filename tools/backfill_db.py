#!/usr/bin/env python3
"""Backfill the SQLite store from existing game files, then build the endgame tablebase.

Sources:
  - data/selfplay/**/games.jsonl   (one JSON object per game)
  - data/games/*.json              (saved-game metadata from /api/save-game)

Games are deduped by a stable source_ref so re-running is safe. After ingest, the
endgame tablebase is rebuilt from positions with <= TABLEBASE_MAX_PIECES total pieces
by replaying each game once via tools/js/positions_from_game.mjs (Node, authoritative
rules). Build it incrementally and idempotently.

Usage:
    python tools/backfill_db.py [--db data/shatrunz.db] [--no-tablebase] [--max-games N]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import threading

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import db as dbmod  # noqa: E402

STREAM_MJS = ROOT / "tools" / "js" / "endgame_positions_stream.mjs"


def _ingest_selfplay(conn, data_dir: Path) -> tuple[int, int]:
    inserted = skipped = 0
    for jsonl in sorted(data_dir.glob("selfplay/**/games.jsonl")):
        rel = jsonl.relative_to(data_dir)
        with jsonl.open(encoding="utf-8") as fp:
            for i, line in enumerate(fp):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ref = f"selfplay:{rel}#{obj.get('game', i)}"
                gid = dbmod.upsert_game(
                    conn,
                    {
                        "source": "selfplay",
                        "source_ref": ref,
                        "white": obj.get("white"),
                        "black": obj.get("black"),
                        "white_persona": obj.get("white"),
                        "black_persona": obj.get("black"),
                        "result": obj.get("result"),
                        "moves_uci": obj.get("moves") or [],
                        "terminal": obj.get("terminal"),
                        "mode": "selfplay",
                    },
                )
                if gid is None:
                    skipped += 1
                else:
                    inserted += 1
    conn.commit()
    return inserted, skipped


def _ingest_saved(conn, data_dir: Path) -> tuple[int, int]:
    inserted = skipped = 0
    for jf in sorted((data_dir / "games").glob("game_*.json")):
        try:
            obj = json.loads(jf.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        moves = obj.get("uci_moves") or obj.get("moves") or []
        gid = dbmod.upsert_game(
            conn,
            {
                "source": "saved",
                "source_ref": f"saved:{jf.name}",
                "white": obj.get("white"),
                "black": obj.get("black"),
                "white_persona": obj.get("engine_white"),
                "black_persona": obj.get("engine_black"),
                "result": obj.get("result"),
                "moves_uci": moves,
                "mode": obj.get("mode"),
                "created_at": obj.get("timestamp"),
            },
        )
        if gid is None:
            skipped += 1
        else:
            inserted += 1
    conn.commit()
    return inserted, skipped


def _build_tablebase(conn, max_games: int | None, max_plies: int) -> int:
    """Replay games through ONE streaming Node process, tally endgame positions
    (<= max pieces), and rebuild the tablebase. Scales to tens of thousands of games.
    """
    conn.execute("DELETE FROM endgame_moves")
    conn.commit()
    rows = conn.execute(
        "SELECT moves_uci, result FROM games "
        "WHERE result != '*' AND ply_count > 0 AND ply_count <= ? ORDER BY id",
        (max_plies,),
    ).fetchall()
    if max_games:
        rows = rows[:max_games]
    if not rows:
        return 0

    proc = subprocess.Popen(
        ["node", str(STREAM_MJS), str(dbmod.TABLEBASE_MAX_PIECES), str(max_plies)],
        cwd=str(ROOT),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    def feed():
        try:
            for row in rows:
                moves = (row["moves_uci"] or "").split()
                proc.stdin.write(json.dumps({"moves": moves, "result": row["result"]}) + "\n")
            proc.stdin.close()
        except BrokenPipeError:
            pass

    feeder = threading.Thread(target=feed, daemon=True)
    feeder.start()

    seen = 0
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            pos = json.loads(line)
        except json.JSONDecodeError:
            continue
        dbmod.record_tablebase_position(
            conn, pos["key"], pos["stm"], pos.get("uci"),
            pos["result"], piece_count=pos["piece_count"],
        )
        seen += 1
        if seen % 50000 == 0:
            conn.commit()
            print(f"  tablebase: tallied {seen} endgame positions", flush=True)
    proc.wait()
    feeder.join()
    conn.commit()
    return dbmod.recompute_tablebase(conn)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(dbmod.DEFAULT_DB_PATH))
    ap.add_argument("--data-dir", default=str(ROOT / "data"))
    ap.add_argument("--no-tablebase", action="store_true")
    ap.add_argument("--max-games", type=int, default=None, help="cap games for tablebase build")
    ap.add_argument("--max-plies", type=int, default=300,
                    help="skip degenerate games longer than this for tablebase")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    conn = dbmod.connect(args.db)
    dbmod.init_db(conn)

    sp_ins, sp_skip = _ingest_selfplay(conn, data_dir)
    sv_ins, sv_skip = _ingest_saved(conn, data_dir)
    print(f"Self-play: +{sp_ins} new, {sp_skip} dup")
    print(f"Saved:     +{sv_ins} new, {sv_skip} dup")

    if not args.no_tablebase:
        if not STREAM_MJS.is_file():
            print("WARN: endgame_positions_stream.mjs missing; skipping tablebase", file=sys.stderr)
        else:
            n = _build_tablebase(conn, args.max_games, args.max_plies)
            print(f"Tablebase: {n} endgame positions (<= {dbmod.TABLEBASE_MAX_PIECES} pieces)")

    print("Stats:", json.dumps(dbmod.stats(conn), indent=2))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
