"""
ShatrunZ Backend Server
Handles file storage, game analysis, and AI training
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
from pathlib import Path
import sys

# Version helper
from backend.version import get_repo_version

# Add engine to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'engine'))
from engine_wrapper import ShatrunZEngine

app = Flask(__name__)
CORS(app)  # Enable CORS for browser requests

# Initialize C Engine
print("🚀 Initializing C Engine...")
try:
    engine = ShatrunZEngine(str(Path(__file__).parent.parent / 'engine' / 'shatrunz_engine'))
    print("✅ C Engine ready!")
except Exception as e:
    print(f"⚠️  C Engine failed to load: {e}")
    engine = None

# Directories
BASE_DIR = Path(__file__).parent.parent  # Point to root
DATA_DIR = BASE_DIR / 'data'
GAMES_DIR = DATA_DIR / 'games'
BRAINS_DIR = DATA_DIR / 'brains'
LOGS_DIR = DATA_DIR / 'logs'

# Create directories
for dir_path in [DATA_DIR, GAMES_DIR, BRAINS_DIR, LOGS_DIR]:
    dir_path.mkdir(exist_ok=True)

# Serve static files
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

# Save PGN game
@app.route('/api/save-game', methods=['POST'])
def save_game():
    data = request.json
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"game_{timestamp}.pgn"
    filepath = GAMES_DIR / filename
    
    with open(filepath, 'w') as f:
        f.write(data['pgn'])
    
    # Also save metadata
    metadata = {
        'white': data.get('white', 'Unknown'),
        'black': data.get('black', 'Unknown'),
        'result': data.get('result', '*'),
        'moves': data.get('moves', []),
        'timestamp': timestamp
    }
    
    meta_filepath = GAMES_DIR / f"game_{timestamp}.json"
    with open(meta_filepath, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Game saved: {filename}")
    return jsonify({'success': True, 'filename': filename})

# Save brain data
@app.route('/api/save-brain', methods=['POST'])
def save_brain():
    data = request.json
    brain_name = data.get('name', 'unknown')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"brain_{brain_name}_{timestamp}.json"
    filepath = BRAINS_DIR / filename
    
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    
    # Also update the "latest" version
    latest_filepath = BRAINS_DIR / f"brain_{brain_name}_latest.json"
    with open(latest_filepath, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"🧠 Brain saved: {filename}")
    return jsonify({'success': True, 'filename': filename})

# Load latest brain
@app.route('/api/load-brain/<name>', methods=['GET'])
def load_brain(name):
    filepath = BRAINS_DIR / f"brain_{name}_latest.json"
    
    if filepath.exists():
        with open(filepath, 'r') as f:
            data = json.load(f)
        return jsonify({'success': True, 'data': data})
    else:
        return jsonify({'success': False, 'error': 'Brain not found'}), 404

# Get game list
@app.route('/api/games', methods=['GET'])
def get_games():
    games = []
    for filepath in sorted(GAMES_DIR.glob('game_*.json'), reverse=True):
        with open(filepath, 'r') as f:
            metadata = json.load(f)
            games.append(metadata)
    
    return jsonify({'success': True, 'games': games[:50]})  # Last 50 games

# Trigger game analysis
@app.route('/api/analyze-game', methods=['POST'])
def analyze_game():
    data = request.json
    
    # Save game for analysis
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    analysis_file = GAMES_DIR / f"analysis_{timestamp}.json"
    
    with open(analysis_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"📊 Game queued for analysis: {timestamp}")
    
    # Trigger inspector (will be picked up by inspector.py)
    return jsonify({'success': True, 'message': 'Game queued for analysis'})

# Get best move from C engine
@app.route('/api/engine-move', methods=['POST'])
def engine_move():
    if not engine:
        return jsonify({'success': False, 'error': 'Engine not available'}), 503
    
    try:
        data = request.json
        fen = data.get('fen')  # Optional FEN string (fallback only)
        moves = data.get('moves')  # Optional UCI move list (preferred)
        depth = data.get('depth', 5)
        randomness = data.get('randomness', 0)

        # Accept either list[str] or a single space-delimited string.
        if isinstance(moves, str):
            moves = [m for m in moves.split() if m]
        if moves is not None and not isinstance(moves, list):
            return jsonify({'success': False, 'error': 'moves must be a list of UCI strings or a space-delimited string'}), 400
        
        move = engine.get_best_move(fen=fen, moves=moves, depth=depth, randomness=randomness)
        
        if move:
            return jsonify({'success': True, 'move': move})
        else:
            return jsonify({'success': False, 'error': 'No legal moves'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Health check
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'version': get_repo_version(),
        'engine_available': engine is not None,
        'games_count': len(list(GAMES_DIR.glob('game_*.json'))),
        'brains_count': len(list(BRAINS_DIR.glob('brain_*_latest.json')))
    })

if __name__ == '__main__':
    import logging
    
    # Suppress Flask HTTP request logs
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    print("🚀 ShatrunZ Server Starting...")
    print(f"📁 Data directory: {DATA_DIR}")
    print(f"🎮 Games directory: {GAMES_DIR}")
    print(f"🧠 Brains directory: {BRAINS_DIR}")
    print(f"📝 Logs directory: {LOGS_DIR}")
    print("\n🌐 Server running on http://localhost:8000")
    print("Press Ctrl+C to stop\n")
    
    app.run(host='0.0.0.0', port=8000, debug=False, use_reloader=False)
