"""
Python wrapper for ShatrunZ C Engine
Communicates via UCI protocol
"""

import subprocess
import threading
import queue

class ShatrunZEngine:
    def __init__(self, engine_path='./engine/shatrunz_engine', init_commands=None):
        self.engine_path = engine_path
        self.init_commands = init_commands or []
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
            try:
                line = self.process.stdout.readline()
            except Exception:
                break
            if not line:
                break
            self.output_queue.put(line.strip())
    
    def _init_engine(self):
        """Initialize UCI protocol"""
        self.send('uci')
        while True:
            line = self.get_response()
            if line == 'uciok':
                break

        # Apply any engine-specific initialization *before* isready.
        # This is important for variant engines (e.g. Fairy-Stockfish) where
        # setoption (VariantPath/UCI_Variant) must be set before we start searching.
        for cmd in self.init_commands:
            if not cmd:
                continue
            self.send(cmd)

        self.send('isready')
        while True:
            line = self.get_response()
            if line == 'readyok':
                self.ready = True
                break
    
    def send(self, command):
        """Send command to engine"""
        if self.process and self.process.stdin:
            try:
                self.process.stdin.write(command + '\n')
                self.process.stdin.flush()
            except (BrokenPipeError, ValueError):
                # Engine already exited; treat as no-op so callers can fallback.
                return
    
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
    
    def get_legal_moves(self, moves=None):
        """Return sorted UCI legal moves from startpos + optional move list."""
        if not self.ready:
            return []
        if moves:
            if isinstance(moves, str):
                moves = [m for m in moves.split() if m]
            self.send(f"position startpos moves {' '.join(moves)}")
        else:
            self.send('position startpos')
        self.send('legal')
        while True:
            line = self.get_response(timeout=10)
            if not line:
                return []
            if line.startswith('legalmoves'):
                parts = line.split()
                return sorted(parts[1:]) if len(parts) > 1 else []

    def _set_position(self, fen=None, moves=None):
        if moves:
            if isinstance(moves, str):
                moves = [m for m in moves.split() if m]
            self.send(f"position startpos moves {' '.join(moves)}")
        elif fen:
            self.send(f'position fen {fen}')
        else:
            self.send('position startpos')

    def get_best_move(
        self,
        fen=None,
        moves=None,
        depth=5,
        randomness=0,
        movetime_ms=None,
        wtime=None,
        btime=None,
        winc=0,
        binc=0,
    ):
        """Get best move; movetime or clock fields override depth-only search."""
        if not self.ready:
            return None

        self._set_position(fen=fen, moves=moves)

        go_parts = ['go']
        if movetime_ms and int(movetime_ms) > 0:
            go_parts.append(f'movetime {int(movetime_ms)}')
        elif wtime is not None or btime is not None:
            if wtime is not None:
                go_parts.append(f'wtime {int(wtime)}')
            if btime is not None:
                go_parts.append(f'btime {int(btime)}')
            if winc:
                go_parts.append(f'winc {int(winc)}')
            if binc:
                go_parts.append(f'binc {int(binc)}')
            if depth:
                go_parts.append(f'depth {int(depth)}')
        else:
            go_parts.append(f'depth {int(depth)}')

        if randomness:
            go_parts.append(f'randomness {int(randomness)}')

        self.send(' '.join(go_parts))

        while True:
            line = self.get_response(timeout=120)
            if not line:
                break
            if line.startswith('info '):
                continue
            if line.startswith('bestmove'):
                parts = line.split()
                if len(parts) >= 2:
                    mv = parts[1]
                    if mv in ('0000', '(none)', 'none'):
                        return None
                    return mv
                return None

    def _parse_info_line(self, line):
        parts = line.split()
        if 'depth' not in parts or 'score' not in parts:
            return None
        out = {'type': 'info'}
        try:
            out['depth'] = int(parts[parts.index('depth') + 1])
        except (ValueError, IndexError):
            pass
        try:
            if 'cp' in parts:
                out['cp'] = int(parts[parts.index('cp') + 1])
        except (ValueError, IndexError):
            pass
        if 'pv' in parts:
            idx = parts.index('pv')
            out['pv'] = parts[idx + 1:]
        return out

    def iter_search(
        self,
        fen=None,
        moves=None,
        depth=5,
        randomness=0,
        movetime_ms=None,
        wtime=None,
        btime=None,
        winc=0,
        binc=0,
    ):
        """Yield info/bestmove events while searching."""
        if not self.ready:
            return
        self._set_position(fen=fen, moves=moves)
        go_parts = ['go']
        if movetime_ms and int(movetime_ms) > 0:
            go_parts.append(f'movetime {int(movetime_ms)}')
        elif wtime is not None or btime is not None:
            if wtime is not None:
                go_parts.append(f'wtime {int(wtime)}')
            if btime is not None:
                go_parts.append(f'btime {int(btime)}')
            if winc:
                go_parts.append(f'winc {int(winc)}')
            if binc:
                go_parts.append(f'binc {int(binc)}')
            if depth:
                go_parts.append(f'depth {int(depth)}')
        else:
            go_parts.append(f'depth {int(depth)}')
        if randomness:
            go_parts.append(f'randomness {int(randomness)}')
        self.send(' '.join(go_parts))
        while True:
            line = self.get_response(timeout=120)
            if not line:
                break
            if line.startswith('info '):
                parsed = self._parse_info_line(line)
                if parsed:
                    yield parsed
                continue
            if line.startswith('bestmove'):
                parts = line.split()
                mv = parts[1] if len(parts) >= 2 else None
                yield {'type': 'bestmove', 'move': mv}
                return

    def get_eval_cp(self, moves=None, fen=None):
        """Static eval (cp) from side to move; requires C engine `eval` command."""
        if not self.ready:
            return None

        self._set_position(fen=fen, moves=moves)
        self.send('eval')
        while True:
            line = self.get_response(timeout=10)
            if not line:
                return None
            if line.startswith('info score cp'):
                parts = line.split()
                try:
                    idx = parts.index('cp')
                    return int(parts[idx + 1])
                except (ValueError, IndexError):
                    return None

    def quit(self):
        """Shutdown engine"""
        if not self.process:
            return
        try:
            self.send('quit')
        except Exception:
            pass
        try:
            self.process.wait(timeout=2)
        except Exception:
            pass
        for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
            try:
                if stream:
                    stream.close()
            except Exception:
                pass
        self.process = None
    
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
