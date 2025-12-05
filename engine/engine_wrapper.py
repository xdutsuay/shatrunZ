"""
Python wrapper for ShatrunZ C Engine
Communicates via UCI protocol
"""

import subprocess
import threading
import queue

class ShatrunZEngine:
    def __init__(self, engine_path='./engine/shatrunz_engine'):
        self.engine_path = engine_path
        self.process = None
        self.ready = False
        self.output_queue = queue.Queue()
        self._start_engine()
    
    def _start_engine(self):
        """Start the engine process"""
        self.process = subprocess.Popen(
            [self.engine_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Start output reader thread
        self.reader_thread = threading.Thread(target=self._read_output, daemon=True)
        self.reader_thread.start()
        
        # Initialize engine
        self._init_engine()
    
    def _read_output(self):
        """Read engine output in background thread"""
        while True:
            line = self.process.stdout.readline()
            if not line:
                break
            self.output_queue.put(line.strip())
    
    def _init_engine(self):
        """Initialize UCI protocol"""
        self.send('uci')
        while True:
            line = self.get_response()
            print(f"Engine init: {line}")
            if line == 'uciok':
                break
        
        self.send('isready')
        while True:
            line = self.get_response()
            if line == 'readyok':
                self.ready = True
                print("✅ Engine ready!")
                break
    
    def send(self, command):
        """Send command to engine"""
        if self.process and self.process.stdin:
            self.process.stdin.write(command + '\n')
            self.process.stdin.flush()
    
    def get_response(self, timeout=5):
        """Get response from engine"""
        try:
            return self.output_queue.get(timeout=timeout)
        except queue.Empty:
            return None
    
    def new_game(self):
        """Start a new game"""
        self.send('ucinewgame')
        self.send('isready')
        while True:
            line = self.get_response()
            if line == 'readyok':
                break
    
    def get_best_move(self, fen=None, depth=5):
        """
        Get best move from current position
        
        Args:
            fen: FEN string (optional, uses startpos if None)
            depth: Search depth
            randomness: Level of randomness to introduce (0-100)
        
        Returns:
            UCI move string (e.g., "e2e4")
        """
        if not self.ready:
            return None
        
        # Set position
        if fen:
            self.send(f'position fen {fen}')
        else:
            self.send('position startpos')
        
        # Search
        self.send(f'go depth {depth} randomness {randomness}')
        
        # Wait for bestmove
        while True:
            line = self.get_response()
            if line and line.startswith('bestmove'):
                parts = line.split()
                if len(parts) >= 2:
                    return parts[1]
                return None
    
    def quit(self):
        """Shutdown engine"""
        if self.process:
            self.send('quit')
            self.process.wait(timeout=2)
    
    def __del__(self):
        """Cleanup on deletion"""
        self.quit()


# Test if run directly
if __name__ == '__main__':
    print("Testing ShatrunZ Engine...")
    engine = ShatrunZEngine()
    
    print("\nGetting best move from starting position...")
    move = engine.get_best_move(depth=5)
    print(f"Best move: {move}")
    
    engine.quit()
    print("Test complete!")
