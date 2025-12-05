from tabulate import tabulate
from ChessEngine import GameLog

def view_game_log():
    game_log = GameLog()
    game_log.load_from_pickle()

    # Create a list of tuples for the table
    table_data = [(game_id, move) for game_id, move in game_log.log]

    # Define the table headers
    headers = ["Game ID", "Move"]

    # Display the game log in tabular format
    print(tabulate(table_data, headers, tablefmt="grid"))

if __name__ == "__main__":
    view_game_log()

# from tabulate import tabulate
# from ChessEngine import GameLog
#
#
# def view_game_log():
#     game_log = GameLog()
#     game_log.load_from_pickle()
#
#     # Group moves by the same game ID
#     grouped_moves = {}
#     for game_id, move in game_log.log:
#         if game_id not in grouped_moves:
#             grouped_moves[game_id] = []
#         grouped_moves[game_id].append(move)
#
#     # Prepare data for tabulation
#     table_data = []
#     for game_id, moves in grouped_moves.items():
#         move_str = ' -> '.join(moves)
#         table_data.append([game_id, move_str])
#
#     # Define the table headers
#     headers = ["Game ID", "Moves"]
#
#     # Display the game log in tabular format
#     print(tabulate(table_data, headers, tablefmt="grid"))
#
#
# if __name__ == "__main__":
#     view_game_log()
