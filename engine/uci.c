/*
 * UCI Protocol Implementation
 * Universal Chess Interface for communication with GUI/backend
 */

#include "types.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Forward declarations
void init_position(Position *pos);
Move search(Position *pos, int depth, int randomness);

// Convert square to algebraic notation (e.g., e2)
void square_to_str(Square sq, char *str) {
  static const char files[] = "abcdefghi";
  int r = square_rank(sq);
  int c = square_file(sq);
  sprintf(str, "%c%d", files[c], 9 - r);
}

// Convert algebraic notation to square (e.g., "e2" -> square)
Square str_to_square(const char *str) {
  static const char files[] = "abcdefghi";
  int c = -1;
  for (int i = 0; i < 9; i++) {
    if (files[i] == str[0]) {
      c = i;
      break;
    }
  }
  if (c == -1)
    return -1;

  int r = 9 - (str[1] - '0');
  return make_square(r, c);
}

// UCI main loop
void uci_loop() {
  char line[4096];
  Position pos;
  init_position(&pos);

  while (fgets(line, sizeof(line), stdin)) {
    // Remove newline
    line[strcspn(line, "\n")] = 0;

    if (strcmp(line, "uci") == 0) {
      printf("id name ShatrunZ Engine v1.0\n");
      printf("id author ShatrunZ Team\n");
      printf("uciok\n");
      fflush(stdout);
    } else if (strcmp(line, "isready") == 0) {
      printf("readyok\n");
      fflush(stdout);
    } else if (strcmp(line, "ucinewgame") == 0) {
      init_position(&pos);
    } else if (strncmp(line, "position startpos", 17) == 0) {
      init_position(&pos);

      // TODO: Parse moves if present
      char *moves_str = strstr(line, "moves");
      if (moves_str) {
        // Parse and apply moves
      }
    } else if (strncmp(line, "go", 2) == 0) {
      // Parse depth
      int depth = 5; // Default depth
      char *depth_str = strstr(line, "depth");
      if (depth_str) {
        sscanf(depth_str, "depth %d", &depth);
      }

      // Parse randomness
      int randomness = 0;
      char *rand_str = strstr(line, "randomness");
      if (rand_str) {
        sscanf(rand_str, "randomness %d", &randomness);
      }

      // Search for best move
      Move best = search(&pos, depth, randomness);

      if (best.from >= 0) {
        char from_str[4], to_str[4];
        square_to_str(best.from, from_str);
        square_to_str(best.to, to_str);

        if (best.is_promotion) {
          char promo_char = 'q'; // Default to queen
          switch (best.promotion_type) {
          case QUEEN:
            promo_char = 'q';
            break;
          case ROOK:
            promo_char = 'r';
            break;
          case BISHOP:
            promo_char = 'b';
            break;
          case KNIGHT:
            promo_char = 'n';
            break;
          default:
            break;
          }
          printf("bestmove %s%s%c\n", from_str, to_str, promo_char);
        } else {
          printf("bestmove %s%s\n", from_str, to_str);
        }
      } else {
        printf("bestmove 0000\n"); // No legal moves
      }
      fflush(stdout);
    } else if (strcmp(line, "quit") == 0) {
      break;
    }
  }
}

int main() {
  uci_loop();
  return 0;
}
