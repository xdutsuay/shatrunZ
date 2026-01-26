import unittest
import sys
import os
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from engine.engine_wrapper import ShatrunZEngine

class TestEngine(unittest.TestCase):
    def setUp(self):
        self.engine_path = str(Path(__file__).parent.parent / 'engine' / 'shatrunz_engine')
        self.engine = ShatrunZEngine(self.engine_path)

    def tearDown(self):
        self.engine.quit()

    def test_uci_connection(self):
        """Verify engine responds to UCI commands"""
        # engine_wrapper does uci/isready in init
        self.assertTrue(self.engine.ready)

    def test_startpos_9x9(self):
        """Verify startpos is valid"""
        # We can't easily inspect internal state without extra commands, 
        # but we can try to get a move.
        move = self.engine.get_best_move(depth=1)
        self.assertIsNotNone(move)
        # 9x9 moves likely look like e2e4 but with different coords?
        # Actually UCI notation depends on our square_to_str implementation.
        # Let's verify it returns a 4-5 char string.
        self.assertTrue(len(move) >= 4)

    def test_krishna_existence(self):
        """Implicitly verify Krishna by checking if engine plays moves involving it?
        Or just generic ensure no crash."""
        # For now, just ensure engine doesn't crash on go
        self.engine.send('ucinewgame')
        self.engine.send('isready')
        self.engine.get_response()
        move = self.engine.get_best_move(depth=1)
        self.assertIsNotNone(move)

if __name__ == '__main__':
    unittest.main()
