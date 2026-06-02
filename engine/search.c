/*
 * Search algorithm (Alpha-Beta with move ordering + quiescence)
 */

#include "types.h"
#include <limits.h>
#include <stdio.h>
#include <stdlib.h> // for rand()
#include <string.h>
#include <time.h>

// Forward declarations
int evaluate(const Position *pos);
int generate_legal_moves(Position *pos, Move *moves);
void make_move(Position *pos, const Move *move);
void unmake_move(Position *pos, const Move *move);
bool is_in_check(const Position *pos, Color color);

static const int MATE_SCORE = 100000;

static void square_to_uci(Square sq, char *from, char *to_out) {
  static const char files[] = "abcdefghi";
  int r = square_rank(sq);
  int c = square_file(sq);
  sprintf(from, "%c%d", files[c], 9 - r);
  (void)to_out;
}

static void emit_search_info(int depth, int score_cp, Move m) {
  if (m.from < 0) {
    return;
  }
  char f[4], t[4];
  square_to_uci(m.from, f, t);
  square_to_uci(m.to, t, t);
  printf("info depth %d score cp %d pv %s%s\n", depth, score_cp, f, t);
  fflush(stdout);
}

// Move ordering: captures first, then others
void order_moves(Move *moves, int count) {
  for (int i = 0; i < count - 1; i++) {
    for (int j = i + 1; j < count; j++) {
      int score_i = (moves[i].captured != NO_PIECE) ? 1000 : 0;
      int score_j = (moves[j].captured != NO_PIECE) ? 1000 : 0;

      if (score_j > score_i) {
        Move temp = moves[i];
        moves[i] = moves[j];
        moves[j] = temp;
      }
    }
  }
}

static bool move_gives_check(Position *pos, const Move *move) {
  make_move(pos, move);
  Color victim = pos->side_to_move;
  bool check = is_in_check(pos, victim);
  unmake_move(pos, move);
  return check;
}

static bool is_noisy_move(Position *pos, const Move *move) {
  if (move->captured != NO_PIECE) {
    return true;
  }
  return move_gives_check(pos, move);
}

static int terminal_score(const Position *pos, int ply_offset) {
  if (is_in_check(pos, pos->side_to_move)) {
    return -MATE_SCORE + ply_offset;
  }
  return 0;
}

// Quiescence search at depth 0 (captures and checks only)
static int quiescence(Position *pos, int alpha, int beta, int ply) {
  int stand_pat = evaluate(pos);
  if (stand_pat >= beta) {
    return beta;
  }
  if (stand_pat > alpha) {
    alpha = stand_pat;
  }

  Move moves[MAX_MOVES];
  int move_count = generate_legal_moves(pos, moves);
  if (move_count == 0) {
    return terminal_score(pos, ply);
  }

  order_moves(moves, move_count);

  for (int i = 0; i < move_count; i++) {
    if (!is_noisy_move(pos, &moves[i])) {
      continue;
    }

    make_move(pos, &moves[i]);
    int score = -quiescence(pos, -beta, -alpha, ply + 1);
    unmake_move(pos, &moves[i]);

    if (score >= beta) {
      return beta;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  return alpha;
}

// Alpha-beta search
int alphabeta(Position *pos, int depth, int alpha, int beta, int ply) {
  if (depth <= 0) {
    return quiescence(pos, alpha, beta, ply);
  }

  Move moves[MAX_MOVES];
  int move_count = generate_legal_moves(pos, moves);

  if (move_count == 0) {
    return terminal_score(pos, ply);
  }

  order_moves(moves, move_count);

  for (int i = 0; i < move_count; i++) {
    make_move(pos, &moves[i]);
    int score = -alphabeta(pos, depth - 1, -beta, -alpha, ply + 1);
    unmake_move(pos, &moves[i]);

    if (score >= beta) {
      return beta;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  return alpha;
}

// Find best move
Move search(Position *pos, int depth, int randomness) {
  Move moves[MAX_MOVES];
  int move_count = generate_legal_moves(pos, moves);

  if (move_count == 0) {
    return (Move){-1, -1, NO_PIECE, false, NO_PIECE, 0};
  }

  order_moves(moves, move_count);

  Move best_move = moves[0];
  int best_score = INT_MIN;

  for (int i = 0; i < move_count; i++) {
    make_move(pos, &moves[i]);
    int score = -alphabeta(pos, depth - 1, INT_MIN, INT_MAX, 1);
    unmake_move(pos, &moves[i]);

    if (randomness > 0) {
      int noise = (rand() % (2 * randomness + 1)) - randomness;
      score += noise;
    }

    if (score > best_score) {
      best_score = score;
      best_move = moves[i];
    }
  }

  return best_move;
}

Move search_timed(Position *pos, int max_depth, int randomness, int time_ms) {
  if (time_ms <= 0) {
    return search(pos, max_depth > 0 ? max_depth : 5, randomness);
  }

  clock_t start = clock();
  double limit_sec = ((double)time_ms / 1000.0) * 0.9;
  if (limit_sec < 0.01) {
    limit_sec = 0.01;
  }

  Move best_move = (Move){-1, -1, NO_PIECE, false, NO_PIECE, 0};
  int cap = max_depth > 0 ? max_depth : 64;

  for (int depth = 1; depth <= cap; depth++) {
    Move candidate = search(pos, depth, randomness);
    if (candidate.from >= 0) {
      best_move = candidate;
      emit_search_info(depth, evaluate(pos), candidate);
    }

    double elapsed = (double)(clock() - start) / CLOCKS_PER_SEC;
    if (elapsed >= limit_sec) {
      break;
    }
  }

  if (best_move.from < 0) {
    return search(pos, 1, randomness);
  }

  return best_move;
}
