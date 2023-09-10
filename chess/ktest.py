import unittest
from ChessEngine import GameState, Move


class TestKrishnaMoves(unittest.TestCase):
    def setUp(self):
        self.game_state = GameState()

    def test_valid_krishna_moves(self):
        # Test valid Krishna moves in different directions
        # Example 1: Move the Krishna piece one square diagonally
        self.game_state.board = [
            ["--", "--", "--", "--", "--", "--", "--", "--"],
            ["--", "--", "--", "--", "--", "--", "--", "--"],
            ["--", "--", "--", "--", "--", "--", "--", "--"],
            ["--", "--", "--", "--", "wKK", "--", "--", "--"],
            ["--", "--", "--", "--", "--", "--", "--", "--"],
            ["--", "--", "--", "--", "--", "--", "--", "--"],
            ["--", "--", "--", "--", "--", "--", "--", "--"],
            ["--", "--", "--", "--", "--", "--", "--", "--"]
        ]
        moves = []  # Create an empty list to pass as the 'moves' argument
        valid_moves = self.game_state.getKrishnaMoves(3, 3, moves)
        expected_moves = [Move((3, 3), (2, 2), self.game_state.board)]
        self.assertEqual(valid_moves, expected_moves)

        # Example 2: Move the Krishna piece two squares diagonally
        self.game_state.board = [
            # Same board setup as in your test cases
        ]
        moves = []  # Create an empty list to pass as the 'moves' argument
        valid_moves = self.game_state.getKrishnaMoves(3, 3, moves)
        expected_moves = [Move((3, 3), (1, 1), self.game_state.board)]
        self.assertEqual(valid_moves, expected_moves)

        # Add more valid Krishna move tests

    def test_invalid_krishna_moves(self):
        # Test invalid Krishna moves
        # Example: Krishna cannot capture other pieces
        self.game_state.board = [
            # Same board setup as in your test cases
        ]
        moves = []  # Create an empty list to pass as the 'moves' argument
        invalid_moves = self.game_state.getKrishnaMoves(3, 3, moves)
        self.assertEqual(invalid_moves, [])

        # Add more invalid Krishna move tests


if __name__ == '__main__':
    unittest.main()
