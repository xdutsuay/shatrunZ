"""Shared engine binary path for pytest (P5 gate).

Set SHATRUNZ_ENGINE to point at the Rust drop-in, e.g.
  SHATRUNZ_ENGINE=target/release/shatrunz_engine make p5-test
Default remains the C oracle at engine/shatrunz_engine.
"""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def engine_binary() -> Path:
    override = os.environ.get("SHATRUNZ_ENGINE")
    if override:
        return Path(override)
    return ROOT / "engine" / "shatrunz_engine"
