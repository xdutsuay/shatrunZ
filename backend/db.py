"""SQLite system-of-record for ShatrunZ games + an endgame tablebase cache.

Design (hybrid storage, per the project plan):
  - SQLite (this module, stdlib only) is the durable store for games + moves and
    an endgame tablebase keyed on positions with <= TABLEBASE_MAX_PIECES total pieces.
  - ML feature extraction / training consumes a Parquet/JSONL export produced by
    tools/export_ml.py (DuckDB optional), so the heavy analytics deps stay optional.

The DB lives at data/shatrunz.db by default. Everything here uses only the Python
standard library so the backend has no new hard dependencies.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable

# A position is "endgame" for tablebase purposes when both sides together have at
# most this many pieces on the board (per product decision: <= 9 total pieces).
TABLEBASE_MAX_PIECES = 9

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "shatrunz.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS games (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source        TEXT NOT NULL,            -- 'selfplay' | 'saved' | 'live'
    source_ref    TEXT UNIQUE,              -- dedup key (e.g. file path + game index)
    white         TEXT,
    black         TEXT,
    white_persona TEXT,
    black_persona TEXT,
    result        TEXT,                     -- '1-0' | '0-1' | '1/2-1/2' | '*'
    ply_count     INTEGER DEFAULT 0,
    terminal      INTEGER DEFAULT 0,
    mode          TEXT,
    moves_uci     TEXT,                     -- space-joined UCI move list
    created_at    TEXT
);

CREATE TABLE IF NOT EXISTS moves (
    game_id INTEGER NOT NULL,
    ply     INTEGER NOT NULL,
    side    TEXT,                           -- 'w' | 'b'
    uci     TEXT NOT NULL,
    PRIMARY KEY (game_id, ply),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_moves_uci ON moves(uci);

-- Per (position, side-to-move, candidate move) outcome tallies from played games.
CREATE TABLE IF NOT EXISTS endgame_moves (
    position_key TEXT NOT NULL,
    side_to_move TEXT NOT NULL,             -- 'w' | 'b'
    uci          TEXT NOT NULL,
    piece_count  INTEGER DEFAULT 0,
    wins         INTEGER DEFAULT 0,         -- from side_to_move's perspective
    draws        INTEGER DEFAULT 0,
    losses       INTEGER DEFAULT 0,
    visits       INTEGER DEFAULT 0,
    PRIMARY KEY (position_key, side_to_move, uci)
);

-- Best-known move per endgame position (recomputed from endgame_moves).
CREATE TABLE IF NOT EXISTS endgame_tablebase (
    position_key TEXT NOT NULL,
    side_to_move TEXT NOT NULL,
    piece_count  INTEGER NOT NULL,
    best_uci     TEXT,
    wins         INTEGER DEFAULT 0,
    draws        INTEGER DEFAULT 0,
    losses       INTEGER DEFAULT 0,
    visits       INTEGER DEFAULT 0,
    PRIMARY KEY (position_key, side_to_move)
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""


def connect(db_path: str | Path | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def _normalize_result(result: str | None) -> str:
    if result in ("1-0", "0-1", "1/2-1/2"):
        return result
    return "*"


def upsert_game(conn: sqlite3.Connection, record: dict[str, Any]) -> int | None:
    """Insert a game (deduped by source_ref). Returns game_id, or None if it existed.

    record keys: source, source_ref, white, black, white_persona, black_persona,
    result, moves_uci (list[str] or str), terminal, mode, created_at.
    """
    moves = record.get("moves_uci") or record.get("moves") or []
    if isinstance(moves, str):
        moves_list = [m for m in moves.split() if m]
    else:
        moves_list = [str(m) for m in moves]
    moves_joined = " ".join(moves_list)
    source_ref = record.get("source_ref")

    if source_ref:
        existing = conn.execute(
            "SELECT id FROM games WHERE source_ref = ?", (source_ref,)
        ).fetchone()
        if existing:
            return None

    cur = conn.execute(
        """
        INSERT INTO games
            (source, source_ref, white, black, white_persona, black_persona,
             result, ply_count, terminal, mode, moves_uci, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.get("source", "unknown"),
            source_ref,
            record.get("white"),
            record.get("black"),
            record.get("white_persona"),
            record.get("black_persona"),
            _normalize_result(record.get("result")),
            len(moves_list),
            1 if record.get("terminal") else 0,
            record.get("mode"),
            moves_joined,
            record.get("created_at"),
        ),
    )
    game_id = cur.lastrowid
    rows = [
        (game_id, ply, "w" if ply % 2 == 0 else "b", uci)
        for ply, uci in enumerate(moves_list)
    ]
    if rows:
        conn.executemany(
            "INSERT OR REPLACE INTO moves (game_id, ply, side, uci) VALUES (?, ?, ?, ?)",
            rows,
        )
    return game_id


def record_tablebase_position(
    conn: sqlite3.Connection,
    position_key: str,
    side_to_move: str,
    uci: str | None,
    result: str,
    piece_count: int = 0,
) -> None:
    """Tally one played endgame position into endgame_moves.

    `result` is the final game result ('1-0' | '0-1' | '1/2-1/2'); outcome is recorded
    from `side_to_move`'s perspective. Positions with no move played (terminal) are skipped.
    """
    if not uci:
        return
    result = _normalize_result(result)
    win = draw = loss = 0
    if result == "1/2-1/2" or result == "*":
        draw = 1
    elif result == "1-0":
        win, loss = (1, 0) if side_to_move == "w" else (0, 1)
    elif result == "0-1":
        win, loss = (1, 0) if side_to_move == "b" else (0, 1)

    conn.execute(
        """
        INSERT INTO endgame_moves
            (position_key, side_to_move, uci, piece_count, wins, draws, losses, visits)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(position_key, side_to_move, uci) DO UPDATE SET
            wins = wins + excluded.wins,
            draws = draws + excluded.draws,
            losses = losses + excluded.losses,
            visits = visits + 1
        """,
        (position_key, side_to_move, uci, piece_count, win, draw, loss),
    )


def recompute_tablebase(conn: sqlite3.Connection) -> int:
    """Rebuild endgame_tablebase from endgame_moves (idempotent).

    Best move per position = highest score = (wins - losses) / visits, tie-broken by
    visit count. Returns number of tablebase rows written.
    """
    conn.execute("DELETE FROM endgame_tablebase")
    rows = conn.execute(
        """
        SELECT position_key, side_to_move, uci, piece_count, wins, draws, losses, visits
        FROM endgame_moves
        """
    ).fetchall()

    agg: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows:
        key = (r["position_key"], r["side_to_move"])
        a = agg.setdefault(
            key,
            {
                "wins": 0, "draws": 0, "losses": 0, "visits": 0,
                "piece_count": r["piece_count"],
                "best_uci": None, "best_score": -2.0, "best_visits": -1,
            },
        )
        a["wins"] += r["wins"]
        a["draws"] += r["draws"]
        a["losses"] += r["losses"]
        a["visits"] += r["visits"]
        v = max(r["visits"], 1)
        score = (r["wins"] - r["losses"]) / v
        if score > a["best_score"] or (score == a["best_score"] and r["visits"] > a["best_visits"]):
            a["best_score"] = score
            a["best_visits"] = r["visits"]
            a["best_uci"] = r["uci"]

    written = 0
    for (position_key, side), a in agg.items():
        conn.execute(
            """
            INSERT OR REPLACE INTO endgame_tablebase
                (position_key, side_to_move, piece_count, best_uci, wins, draws, losses, visits)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                position_key, side, a["piece_count"], a["best_uci"],
                a["wins"], a["draws"], a["losses"], a["visits"],
            ),
        )
        written += 1
    conn.commit()
    return written


def tablebase_lookup(conn: sqlite3.Connection, position_key: str) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM endgame_tablebase WHERE position_key = ?", (position_key,)
    ).fetchone()
    return dict(row) if row else None


def iter_games(conn: sqlite3.Connection, limit: int | None = None) -> Iterable[sqlite3.Row]:
    sql = "SELECT * FROM games ORDER BY id"
    if limit:
        sql += f" LIMIT {int(limit)}"
    yield from conn.execute(sql)


def stats(conn: sqlite3.Connection) -> dict[str, Any]:
    def scalar(sql: str) -> int:
        row = conn.execute(sql).fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    by_result = {
        r["result"]: r["n"]
        for r in conn.execute("SELECT result, COUNT(*) n FROM games GROUP BY result")
    }
    return {
        "games": scalar("SELECT COUNT(*) FROM games"),
        "moves": scalar("SELECT COUNT(*) FROM moves"),
        "tablebase_positions": scalar("SELECT COUNT(*) FROM endgame_tablebase"),
        "endgame_move_rows": scalar("SELECT COUNT(*) FROM endgame_moves"),
        "by_result": by_result,
        "max_pieces": TABLEBASE_MAX_PIECES,
    }
