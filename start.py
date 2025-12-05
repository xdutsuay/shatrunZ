"""
ShatrunZ Unified Launcher
Starts Flask server and Game Inspector in a single process with unified logging
"""

import sys
import os
import threading
import time
from pathlib import Path

# Check if running in virtual environment
def check_venv():
    """Check if we're in a virtual environment"""
    in_venv = hasattr(sys, 'real_prefix') or (
        hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix
    )
    
    if not in_venv:
        print("❌ ERROR: Not running in virtual environment!")
        print()
        print("Please run:")
        print("  source .venv/bin/activate")
        print("  python start.py")
        print()
        print("Or use the shell script:")
        print("  ./start.sh")
        sys.exit(1)

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

def run_server():
    """Run Flask server in a thread"""
    try:
        from server import app
        print("🌐 Flask Server: Starting on port 8000...")
        app.run(host='0.0.0.0', port=8000, debug=False, use_reloader=False)
    except ImportError as e:
        print(f"❌ Failed to import server: {e}")
        print("Make sure flask is installed: pip install flask flask-cors")
        sys.exit(1)

def run_inspector():
    """Run Game Inspector in a thread"""
    try:
        from inspector import GameInspector
        
        # Wait for server to start
        time.sleep(2)
        
        print("👁️  Game Inspector: Starting...")
        inspector = GameInspector()
        inspector.monitor_games()
    except ImportError as e:
        print(f"❌ Failed to import inspector: {e}")
        sys.exit(1)

def main():
    import logging
    
    # Configure logging to show only important messages
    logging.basicConfig(
        level=logging.INFO,
        format='%(message)s'
    )
    
    # Suppress Flask/werkzeug logs
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    
    # Check virtual environment
    check_venv()
    
    print("=" * 70)
    print("🚀 SHATRUNZ BACKEND SYSTEM")
    print("=" * 70)
    print()
    print("📁 Data Directory: data/")
    print("🎮 Games: data/games/")
    print("🧠 Brains: data/brains/")
    print("📝 Logs: data/logs/")
    print()
    print("🌐 Web Interface: http://localhost:8000")
    print("👁️  Live Analysis: This terminal")
    print()
    print("Press Ctrl+C to stop")
    print("=" * 70)
    print()
    
    # Start server in background thread
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # Run inspector in main thread (so we see logs)
    try:
        run_inspector()
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...")
        print("✅ Backend stopped")
        sys.exit(0)

if __name__ == '__main__':
    main()
