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
import subprocess

# Version helper
from backend.version import get_repo_version

# Add engine to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'engine'))
from engine_wrapper import ShatrunZEngine

app = Flask(__name__)
CORS(app)  # Enable CORS for browser requests

# Initialize Engine (default: bundled C engine; optional: external UCI engine)
print("🚀 Initializing Engine...")
engine = None
engine_kind = "none"

external_uci_path = os.environ.get("UCI_ENGINE_PATH")
if external_uci_path:
    # External UCI engine (recommended for Fairy-Stockfish and other variant engines).
    # Provide custom init via UCI_ENGINE_INIT (newline-separated commands), e.g.:
    #   uci
    #   setoption name UCI_Variant value shatrunz
    #   isready
    try:
        init_script = os.environ.get("UCI_ENGINE_INIT")
        init_commands = []
        if init_script:
            # Do not include 'uci' / 'isready' here; the wrapper handles them.
            init_commands = [c.strip() for c in init_script.splitlines() if c.strip() and c.strip() not in ("uci", "isready")]

        engine = ShatrunZEngine(external_uci_path, init_commands=init_commands)
        engine_kind = "external_uci"
        print(f"✅ External UCI engine ready: {external_uci_path}")
    except Exception as e:
        print(f"⚠️  External UCI engine failed to load: {e}")
        engine = None
        engine_kind = "none"
else:
    # Bundled C engine
    try:
        engine_path = Path(__file__).parent.parent / 'engine' / 'shatrunz_engine'
        if not engine_path.exists():
            # Repo sanity: binary is not committed; build it on demand.
            try:
                print("🛠️  Engine binary missing; building with make...")
                subprocess.check_call(["make", "-C", str(engine_path.parent)])
            except Exception as build_err:
                raise RuntimeError(f"Failed to build engine: {build_err}") from build_err

        engine = ShatrunZEngine(str(engine_path))
        engine_kind = "shatrunz_c"
        print("✅ C Engine ready!")
    except Exception as e:
        print(f"⚠️  C Engine failed to load: {e}")
        engine = None
        engine_kind = "none"

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
FRONTEND_DIR = '../frontend'
MODELS_DIR = BASE_DIR / 'models'
MODELS_DIR.mkdir(exist_ok=True)


@app.route('/')
def home():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/pvp')
@app.route('/pvai')
@app.route('/aivai')
def play_page():
    return send_from_directory(FRONTEND_DIR, 'play.html')


@app.route('/models/<path:path>')
def serve_models(path):
    return send_from_directory(MODELS_DIR, path)


@app.route('/api/ml/policy-hint', methods=['POST'])
def ml_policy_hint():
    data = request.json or {}
    uci_prefix = data.get('uci_prefix') or []
    legal_uci = data.get('legal_uci') or []
    try:
        from ml.policy_inference import policy_bonuses_for_position
        bonuses = policy_bonuses_for_position(uci_prefix, legal_uci)
        return jsonify({'success': True, 'bonuses': bonuses})
    except Exception as e:
        return jsonify({'success': False, 'bonuses': {}, 'error': str(e)})


@app.route('/api/ml/metrics', methods=['GET'])
def ml_metrics():
    metrics_path = MODELS_DIR / 'metrics_v1.json'
    if not metrics_path.is_file():
        return jsonify({
            'version': 1,
            'note': 'No metrics yet. Run ml/train.py and ml/eval.py.',
        })
    with open(metrics_path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

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
        'uci_moves': data.get('uci_moves', []),
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
        'engine_kind': engine_kind,
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
