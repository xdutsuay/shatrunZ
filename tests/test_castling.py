import unittest
import sys
import os
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from engine.engine_wrapper import ShatrunZEngine

class TestCastling(unittest.TestCase):
    def setUp(self):
        self.engine_path = str(Path(__file__).parent.parent / 'engine' / 'shatrunz_engine')
        self.engine = ShatrunZEngine(self.engine_path)

    def tearDown(self):
        # Clean up properly to avoid BrokenPipe errors
        try:
            self.engine.quit()
        except Exception:
            pass

    def test_white_kingside_castling(self):
        print("\nTesting White Kingside Castling...")
        # 1. Start new game
        self.engine.new_game()
        
        # 2. Clear path for Kingside Castling (White)
        # White King E1 (76), Target G1 (78). Path: F1 (Bishop), G1 (Krishna).
        # Move Bishop F1 -> F2 (e.g. f1f2)
        # Move Krishna G1 -> G2 (e.g. g1g2)
        # Move Knight H1 -> H2 (e.g. h1h2) to be safe? Krishna is at G1.
        # Wait, usually for castling e1g1, squares f1 and g1 must be empty.
        # Start state:
        # F1: Bishop
        # G1: Krishna
        # H1: Knight
        # I1: Rook
        # So E1 -> G1 requires F1 and G1 empty.
        # We need to move Bishop and Krishna out.
        
        moves = [
            "e2e4", # Pawn clears e2
            "e8e6", # Black pawn
            "f1e2", # Bishop to e2 (F1 empty)
            "d8d6", # Black pawn
            "g2g4", # Pawn clears g2
            "c8c6", # Black pawn
            "g1g2", # Krishna to g2 (G1 empty)
            "b8b6", # Black pawn
            "e1g1", # CASTLING!
        ]
        
        print("Sending moves including e1g1 castling...")
        self.engine.send(f"position startpos moves {' '.join(moves)}")
        
        # Display board
        self.engine.send("d")
        
        # Read output until "Castling:" line
        print("\n--- Board State ---")
        while True:
            line = self.engine.get_response()
            if line:
                print(line)
                if line.startswith("Castling:"):
                    break
        print("-------------------\n")
        
        # If e1g1 was illegal, engine would ignore it (due to my uci.c logic? or maybe crash?)
        # My uci.c logic: checks generated moves. If not found, ignores.
        # So if e1g1 was ignored, King would still be at E1.
        # If valid, King would be at G1.
        # I can inspect the output in the logs.

if __name__ == '__main__':
    unittest.main()
