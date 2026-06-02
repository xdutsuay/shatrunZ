"""Aggregate persisted game metadata for admin Stats."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_PERSONA_SUFFIX = re.compile(r"\s+ai$", re.IGNORECASE)
_RESULT_RE = re.compile(r'\[Result\s+"([^"]+)"\]', re.IGNORECASE)


def _empty_record() -> dict[str, int]:
    return {"wins": 0, "losses": 0, "draws": 0, "games": 0}


def _infer_mode(meta: dict[str, Any]) -> str:
    if meta.get("mode"):
        return str(meta["mode"]).lower()
    white = str(meta.get("white", ""))
    black = str(meta.get("black", ""))
    if black.endswith(" AI") and not white.endswith(" AI"):
        return "hvc"
    if white.endswith(" AI") and black.endswith(" AI"):
        return "cvc"
    return "pvn"


def _persona_from_name(name: str) -> str | None:
    if not name or not str(name).endswith(" AI"):
        return None
    base = _PERSONA_SUFFIX.sub("", str(name).strip())
    return base.lower().replace(" ", "_") if base else None


def _normalize_result(result: str | None) -> str:
    r = (result or "*").strip()
    if r in ("1/2", "1/2-1/2", "draw", "Draw"):
        return "1/2-1/2"
    return r


def _result_from_pgn(pgn_path: Path) -> str | None:
    try:
        text = pgn_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None
    m = _RESULT_RE.search(text)
    return m.group(1) if m else None


def _load_game_meta(json_path: Path, games_dir: Path) -> dict[str, Any] | None:
    try:
        meta = json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    result = _normalize_result(meta.get("result"))
    if result == "*":
        pgn_path = games_dir / json_path.name.replace(".json", ".pgn")
        pgn_result = _result_from_pgn(pgn_path)
        if pgn_result:
            result = _normalize_result(pgn_result)
    meta["result"] = result
    return meta


def aggregate_games(games_dir: Path) -> dict[str, Any]:
    wins_by_color = {"white": _empty_record(), "black": _empty_record()}
    by_mode: dict[str, dict[str, int]] = {}
    by_persona: dict[str, dict[str, int]] = {}
    total = 0

    if not games_dir.is_dir():
        return {
            "total_games": 0,
            "wins_by_color": wins_by_color,
            "by_mode": by_mode,
            "by_persona": by_persona,
        }

    seen_stems: set[str] = set()
    for json_path in sorted(games_dir.glob("game_*.json")):
        stem = json_path.stem
        if stem in seen_stems:
            continue
        seen_stems.add(stem)

        meta = _load_game_meta(json_path, games_dir)
        if not meta:
            continue

        total += 1
        result = meta.get("result", "*")
        mode = _infer_mode(meta)
        mode_stats = by_mode.setdefault(
            mode,
            {"games": 0, "white_wins": 0, "black_wins": 0, "draws": 0},
        )
        mode_stats["games"] += 1

        if result == "1-0":
            wins_by_color["white"]["wins"] += 1
            wins_by_color["black"]["losses"] += 1
            mode_stats["white_wins"] += 1
        elif result == "0-1":
            wins_by_color["black"]["wins"] += 1
            wins_by_color["white"]["losses"] += 1
            mode_stats["black_wins"] += 1
        elif result == "1/2-1/2":
            wins_by_color["white"]["draws"] += 1
            wins_by_color["black"]["draws"] += 1
            mode_stats["draws"] += 1

        for color_key, name in (("white", meta.get("white")), ("black", meta.get("black"))):
            persona = _persona_from_name(str(name or ""))
            if not persona:
                continue
            rec = by_persona.setdefault(persona, _empty_record())
            rec["games"] += 1
            if result == "1-0":
                if color_key == "white":
                    rec["wins"] += 1
                else:
                    rec["losses"] += 1
            elif result == "0-1":
                if color_key == "black":
                    rec["wins"] += 1
                else:
                    rec["losses"] += 1
            elif result == "1/2-1/2":
                rec["draws"] += 1

    for rec in wins_by_color.values():
        rec["games"] = rec["wins"] + rec["losses"] + rec["draws"]

    return {
        "total_games": total,
        "wins_by_color": wins_by_color,
        "by_mode": by_mode,
        "by_persona": by_persona,
    }
