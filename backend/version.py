from __future__ import annotations

from pathlib import Path


def get_repo_version() -> str:
    """
    Repo version, sourced from the top-level VERSION file.
    Falls back to '0.0.0' if missing (e.g. partial checkouts).
    """

    version_path = Path(__file__).parent.parent / "VERSION"
    try:
        return version_path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return "0.0.0"

