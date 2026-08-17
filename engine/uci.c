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
Move search_timed(Position *pos, int max_depth, int randomness, int time_ms);
int evaluate(const Position *pos);
int generate_legal_moves(Position *pos, Move *moves);
void make_move(Position *pos, const Move *move);

static int parse_go_int(const char *line, const char *token, int default_value) {
  char *found = strstr(line, token);
  if (!found) {
    return default_value;
  }
  int value = default_value;
  sscanf(found, "%*s %d", &value);
  return value;
}

static int compute_go_time_ms(const char *line, Color side) {
  int movetime = parse_go_int(line, "movetime", 0);
  if (movetime > 0) {
    return movetime;
  }

  int wtime = parse_go_int(line, "wtime", 0);
  int btime = parse_go_int(line, "btime", 0);
  int winc = parse_go_int(line, "winc", 0);
  int binc = parse_go_int(line, "binc", 0);

  if (wtime <= 0 && btime <= 0) {
    return 0;
  }

  int remaining = (side == WHITE) ? wtime : btime;
  int inc = (side == WHITE) ? winc : binc;
  if (remaining <= 0) {
    remaining = (side == WHITE) ? btime : wtime;
    inc = (side == WHITE) ? binc : winc;
  }
  if (remaining <= 0) {
    return 0;
  }

  /* Mirror frontend/shared/clock_budget.js: never plan to spend more than 40% of
     the remaining clock on one move, keep a 150ms reserve, bound the increment.
     Prevents burning the whole clock on the first move when inc is large / time low. */
  int budget = remaining / 20 + (inc * 4) / 5;
  int cap = (remaining * 2) / 5; /* 40% */
  if (budget > cap) {
    budget = cap;
  }
  int usable = remaining - 150;
  if (usable <= 0) {
    return 50;
  }
  if (budget > usable) {
    budget = usable;
  }
  if (budget < 50) {
    budget = 50;
  }
  return budget;
}

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
  // Guard against short/empty tokens: reading str[1] or str[0] past the NUL
  // was an OOB read that could drive an out-of-range square index below.
  if (str == NULL || strlen(str) < 2) {
    return -1;
  }
  int c = -1;
  for (int i = 0; i < 9; i++) {
    if (files[i] == str[0]) {
      c = i;
      break;
    }
  }
  if (c == -1 || str[1] < '1' || str[1] > '9')
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

      // Parse moves if present
      char *moves_str = strstr(line, "moves");
      if (moves_str) {
        moves_str += 6; // Skip "moves "
        char *token = strtok(moves_str, " ");
        while (token) {
          // Parse single move. A valid token is at least 4 chars (from+to);
          // reject anything shorter before reading token+2 / token[4] so a
          // truncated token cannot read OOB.
          size_t tok_len = strlen(token);
          if (tok_len < 4) {
            token = strtok(NULL, " ");
            continue;
          }
          Square from = str_to_square(token);   // e.g., "e2" -> square
          Square to = str_to_square(token + 2); // e.g., "e4" -> square
          char promo_char = (tok_len >= 5) ? token[4] : '\0'; // Optional promotion char

          // Find matching legal move to get correct formatting/promotion type
          Move legal_moves[MAX_MOVES];
          int count = generate_legal_moves(&pos, legal_moves);
          bool found = false;

          for (int i = 0; i < count; i++) {
            if (legal_moves[i].from == from && legal_moves[i].to == to) {
              // Check promotion
              if (legal_moves[i].is_promotion) {
                char p = 'q';
                if (legal_moves[i].promotion_type == ROOK)
                  p = 'r';
                else if (legal_moves[i].promotion_type == BISHOP)
                  p = 'b';
                else if (legal_moves[i].promotion_type == KNIGHT)
                  p = 'n';

                if (promo_char != p)
                  continue; // Wrong promotion type
              }

              make_move(&pos, &legal_moves[i]);
              found = true;
              break;
            }
          }

          if (!found) {
            // Debug
            // printf("info string Illegal move: %s (from %d to %d)\n", token,
            // from, to);
          }

          token = strtok(NULL, " ");
        }
      }
    } else if (strcmp(line, "legal") == 0) {
      Move legal_moves[MAX_MOVES];
      int count = generate_legal_moves(&pos, legal_moves);
      printf("legalmoves");
      for (int i = 0; i < count; i++) {
        char from_str[4], to_str[4];
        square_to_str(legal_moves[i].from, from_str);
        square_to_str(legal_moves[i].to, to_str);
        if (legal_moves[i].is_promotion) {
          char promo_char = 'q';
          switch (legal_moves[i].promotion_type) {
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
          printf(" %s%s%c", from_str, to_str, promo_char);
        } else {
          printf(" %s%s", from_str, to_str);
        }
      }
      printf("\n");
      fflush(stdout);
    } else if (strcmp(line, "eval") == 0) {
      int score = evaluate(&pos);
      printf("info score cp %d\n", score);
      fflush(stdout);
    } else if (strncmp(line, "go", 2) == 0) {
      int depth = parse_go_int(line, "depth", 5);
      // Clamp so a hostile/accidental `go depth N` (huge N) cannot overflow
      // the recursion stack; MAX_PLY is the recursion bound.
      if (depth < 1)
        depth = 1;
      if (depth > MAX_PLY)
        depth = MAX_PLY;
      int randomness = parse_go_int(line, "randomness", 0);
      int time_ms = compute_go_time_ms(line, pos.side_to_move);

      Move best;
      if (time_ms > 0) {
        best = search_timed(&pos, depth > 0 ? depth : 64, randomness, time_ms);
      } else {
        best = search(&pos, depth, randomness);
      }

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
    } else if (strcmp(line, "d") == 0) {
      // Display board
      printf("\n +---+---+---+---+---+---+---+---+---+\n");
      for (int r = 0; r < 9; r++) { // Rank 9 down to 1
        printf("%d|", 9 - r);
        for (int c = 0; c < 9; c++) {
          Piece p = pos.board[make_square(r, c)]; // 0,0 is A9 (index 0)
          char c_char = '.';
          if (p != NO_PIECE) {
            PieceType pt = piece_type(p);
            Color col = piece_color(p);
            char sym = '?';
            switch (pt) {
            case PAWN:
              sym = 'p';
              break;
            case ROOK:
              sym = 'r';
              break;
            case KNIGHT:
              sym = 'n';
              break;
            case BISHOP:
              sym = 'b';
              break;
            case QUEEN:
              sym = 'q';
              break;
            case KING:
              sym = 'k';
              break;
            case KRISHNA:
              sym = 'z';
              break;
            default:
              sym = '?';
              break;
            }
            if (col == WHITE)
              sym = sym - 32; // Uppercase
            c_char = sym;
          }
          printf(" %c |", c_char);
        }
        printf("\n +---+---+---+---+---+---+---+---+---+\n");
      }
      printf("  a   b   c   d   e   f   g   h   i\n\n");
      printf("Side to move: %s\n",
             pos.side_to_move == WHITE ? "White" : "Black");
      printf("Castling: %c%c%c%c\n", (pos.castling_rights & 1) ? 'K' : '-',
             (pos.castling_rights & 2) ? 'Q' : '-',
             (pos.castling_rights & 4) ? 'k' : '-',
             (pos.castling_rights & 8) ? 'q' : '-');
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
