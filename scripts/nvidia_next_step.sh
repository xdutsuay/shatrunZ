#!/usr/bin/env bash
# Smoke-test NVIDIA API via local nvidia_worker/ (gitignored).
# Key: Cursor Settings → Models → OpenAI API Key, or NVIDIA_API_KEY env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER="$ROOT/nvidia_worker"

if [[ ! -d "$WORKER" ]]; then
  echo "nvidia_worker/ not found at $WORKER (local-only; not in git)." >&2
  exit 1
fi

cd "$ROOT"

# Non-reasoning model gives direct answers for short planning prompts.
export NVIDIA_MODEL="${NVIDIA_MODEL:-meta/llama-3.1-8b-instruct}"

if [[ -f "$ROOT/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/.venv/bin/activate"
fi

python3 -m pip install -q -r "$WORKER/requirements.txt"

echo "=== ping ==="
python3 -m nvidia_worker ping

PROMPT="$(python3 <<'PY'
from pathlib import Path

root = Path(__file__).resolve().parent.parent if False else Path(".")  # cwd is ROOT
root = Path.cwd()
parts = []
parts.append("## NEXT_STEPS.md (excerpt)")
next_steps = root / "docs" / "NEXT_STEPS.md"
if next_steps.is_file():
    lines = next_steps.read_text().splitlines()
    parts.extend(lines[156:165])
parts.append("")
parts.append("## COORDINATION.md (active focus)")
coord = root / "docs" / "COORDINATION.md"
if coord.is_file():
    lines = coord.read_text().splitlines()
    parts.extend(lines[38:41])
parts.append("")
parts.append("## Recent work log (last entry)")
if coord.is_file():
    parts.extend(coord.read_text().splitlines()[-8:])

context = "\n".join(parts)
tpl = (root / "nvidia_worker/tasks/shatrunz-next-step.prompt").read_text()
print(tpl.replace("{{CONTEXT}}", context))
PY
)"

echo ""
echo "=== next one step (NVIDIA API) ==="
python3 -m nvidia_worker run --prompt "$PROMPT" --max-tokens 256 -v
