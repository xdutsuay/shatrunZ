"""
Optional Cursor SDK deep analysis for completed games.
Falls back to heuristic GameInspector when SDK unavailable.
"""

import json
import os
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
LOGS_DIR = BASE_DIR / 'data' / 'logs'
GAMES_DIR = BASE_DIR / 'data' / 'games'


def _heuristic_summary(game_data):
    from inspector import GameInspector
    inspector = GameInspector()
    insights = inspector.analyze_game(game_data)
    return insights, 'heuristic'


def analyze_with_agent(game_data):
    """Return (report_text, source) where source is 'sdk' or 'heuristic'."""
    api_key = os.environ.get('CURSOR_API_KEY')
    if not api_key:
        insights, _ = _heuristic_summary(game_data)
        return _format_insights(game_data, insights, source='heuristic (no CURSOR_API_KEY)'), 'heuristic'

    try:
        from cursor_sdk import Agent, LocalAgentOptions
    except ImportError:
        insights, _ = _heuristic_summary(game_data)
        return _format_insights(game_data, insights, source='heuristic (cursor-sdk not installed)'), 'heuristic'

    white = game_data.get('white', '?')
    black = game_data.get('black', '?')
    result = game_data.get('result', '*')
    moves = game_data.get('moves', [])
    uci = game_data.get('uci_moves', game_data.get('uci_moves', []))

    heuristic_insights, _ = _heuristic_summary(game_data)
    prompt = f"""Analyze this ShatrunZ 9x9 chess variant game briefly (5-8 bullet points).
White: {white}
Black: {black}
Result: {result}
Moves ({len(moves)}): {' '.join(moves[:40])}{'...' if len(moves) > 40 else ''}
UCI: {' '.join(uci[:40]) if uci else 'n/a'}

Heuristic pre-analysis:
{json.dumps(heuristic_insights, indent=2)}

Focus: opening choices, blunders, endgame technique, persona style (Material/Positional/Aggressive), training suggestions."""

    try:
        with Agent.create(
            model='composer-2.5',
            api_key=api_key,
            local=LocalAgentOptions(cwd=str(BASE_DIR)),
        ) as agent:
            text = agent.send(prompt).text()
        report = f"=== Cursor SDK analysis ===\n{text}\n\n=== Heuristic summary ===\n"
        report += _format_insights(game_data, heuristic_insights, source='heuristic')
        return report, 'sdk'
    except Exception as exc:
        insights, _ = _heuristic_summary(game_data)
        report = f"=== SDK failed ({exc}) — heuristic fallback ===\n\n"
        report += _format_insights(game_data, insights, source='heuristic')
        return report, 'heuristic'


def _format_insights(game_data, insights, source='heuristic'):
    lines = [
        f"Game: {game_data.get('white')} vs {game_data.get('black')}",
        f"Result: {game_data.get('result')} | Source: {source}",
        '',
    ]
    for cat, items in insights.items():
        lines.append(f'[{cat.upper()}]')
        for item in items:
            lines.append(f'  {item}')
        lines.append('')
    return '\n'.join(lines)


def save_report(report, prefix='agent_insights'):
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    path = LOGS_DIR / f'{prefix}_{ts}.txt'
    path.write_text(report, encoding='utf-8')
    return path


def bulk_analyze_games(limit=50):
    reports = []
    files = sorted(GAMES_DIR.glob('game_*.json'), reverse=True)[:limit]
    for p in files:
        try:
            data = json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue
        report, src = analyze_with_agent(data)
        reports.append(f'\n{"=" * 60}\nFile: {p.name}\n{report}')
    combined = '\n'.join(reports) if reports else 'No games found.'
    return save_report(combined, prefix='bulk_insights')
