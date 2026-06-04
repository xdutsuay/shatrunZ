# Function-flow traces

Low-level execution maps for ShatrunZ subsystems: Mermaid diagrams plus numbered
call stacks with `file:line` anchors. They are meant for manual code audits — read
code along the trace and mark what is right, wrong, or worth improving.

## Index

| Trace | Entry point | Covers |
|-------|-------------|--------|
| [aivai-flow.md](aivai-flow.md) | `ModeController.startAuto` | AIvAI (CVC) bootstrap → ply loop → JS/C engine fork → game end |

## How these are generated

These traces come from the `/trace-flow` Cursor skill
(`~/.cursor/skills/trace-flow/`). Invoke it with an entry point (function, route,
button handler, CLI command) and it produces the same phased Mermaid + call-stack
format you see here.

## Maintenance

Line numbers drift after edits. Each trace footer records the commit it was verified
against; re-grep the anchors and refresh the tables when you touch the traced files.
