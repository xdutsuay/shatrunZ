import os
import pickle
import random
import string
import time


class GameLog:
    def __init__(self):
        self.log = []

    def append(self, game_id, move):
        self.log.append((game_id, move))
        self.save_to_pickle()  # Save the log after every move

    def get_game_log(self, game_id):
        game_log = []
        for game_move in self.log:
            if game_move[0] == game_id:
                game_log.append(game_move[1])
        return game_log

    def get_all_game_ids(self):
        return list(set(game_move[0] for game_move in self.log))

    def save_to_pickle(self):
        with open("game_log.pickle", "wb") as f:
            pickle.dump(self.log, f)

    def load_from_pickle(self):
        if os.path.exists("game_log.pickle"):
            with open("game_log.pickle", "rb") as f:
                self.log = pickle.load(f)
        else:
            self.log = []

    def generate_game_id(self):
        # Generate a 9-digit alphanumeric game ID with a UNIX timestamp
        while True:
            game_id = ''.join(random.choices(string.ascii_letters + string.digits, k=9))
            game_id += str(int(time.time()))  # Append UNIX timestamp
            if game_id not in self.get_all_game_ids():
                return game_id
