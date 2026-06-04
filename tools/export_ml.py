#!/usr/bin/env python3
"""Export the SQLite game store into ML-friendly formats.

  - JSONL (always, stdlib): one {"moves": [...], "result": "..."} per game, the exact
    shape ml/train.py / ml/dataset.py already consume. This is the bridge from the
    system-of-record (SQLite) to the policy-net trainer.
  - Parquet (optional, requires duckdb): a flat per-move table joined with game result
    for feature engineering / analytics. Skipped with a clear message if duckdb is absent.

Usage:
    python tools/export_ml.py --jsonl data/exports/games.jsonl [--parquet data/exports/moves.parquet]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import db as dbmod  # noqa: E402


def export_jsonl(conn, out_path: Path, only_decisive: bool) -> int:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with out_path.open("w", encoding="utf-8") as fp:
        for row in dbmod.iter_games(conn):
            result = row["result"]
            if only_decisive and result not in ("1-0", "0-1"):
                continue
            moves = (row["moves_uci"] or "").split()
            if not moves:
                continue
            fp.write(json.dumps({
                "moves": moves,
                "result": result,
                "white": row["white"],
                "black": row["black"],
            }) + "\n")
            n += 1
    return n


def export_parquet(conn, out_path: Path) -> str:
    try:
        import duckdb  # type: ignore
    except ImportError:
        return "skipped (duckdb not installed: pip install duckdb)"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    db_path = dbmod.DEFAULT_DB_PATH
    con = duckdb.connect()
    con.execute("INSTALL sqlite; LOAD sqlite;")
    con.execute(f"ATTACH '{db_path}' AS gamedb (TYPE sqlite);")
    con.execute(
        f"""
        COPY (
            SELECT m.game_id, m.ply, m.side, m.uci,
                   g.result, g.white, g.black, g.source
            FROM gamedb.moves m
            JOIN gamedb.games g ON g.id = m.game_id
        ) TO '{out_path}' (FORMAT PARQUET);
        """
    )
    con.close()
    return f"wrote {out_path}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(dbmod.DEFAULT_DB_PATH))
    ap.add_argument("--jsonl", default=str(ROOT / "data" / "exports" / "games.jsonl"))
    ap.add_argument("--parquet", default=None)
    ap.add_argument("--only-decisive", action="store_true", help="drop draws/unfinished")
    args = ap.parse_args()

    conn = dbmod.connect(args.db)
    dbmod.init_db(conn)

    n = export_jsonl(conn, Path(args.jsonl), args.only_decisive)
    print(f"JSONL: {n} games -> {args.jsonl}")

    if args.parquet:
        print("Parquet:", export_parquet(conn, Path(args.parquet)))

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
