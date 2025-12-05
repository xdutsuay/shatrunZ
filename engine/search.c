/*
 * Search algorithm (Alpha-Beta with move ordering)
 */

#include "types.h"
#include <limits.h>
#include <stdlib.h> // for rand()
#include <string.h>

// Forward declarations
int evaluate(const Position *pos);
int generate_legal_moves(Position *pos, Move *moves);
void make_move(Position *pos, const Move *move);
void unmake_move(Position *pos, const Move *move);

// Move ordering: captures first, then others
void order_moves(Move *moves, int count) {
  // Simple bubble sort (good enough for now)
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

// Alpha-beta search
int alphabeta(Position *pos, int depth, int alpha, int beta) {
  if (depth == 0) {
    return evaluate(pos);
  }

  Move moves[MAX_MOVES];
  int move_count = generate_legal_moves(pos, moves);

  // No legal moves - checkmate or stalemate
  if (move_count == 0) {
    // TODO: Check if in check for checkmate vs stalemate
    return evaluate(pos);
  }

  // Order moves (captures first)
  order_moves(moves, move_count);

  for (int i = 0; i < move_count; i++) {
    make_move(pos, &moves[i]);
    int score = -alphabeta(pos, depth - 1, -beta, -alpha);
    unmake_move(pos, &moves[i]);

    if (score >= beta) {
      return beta; // Beta cutoff
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
    return (Move){-1, -1, NO_PIECE, false, NO_PIECE};
  }

  // Order moves
  order_moves(moves, move_count);

  Move best_move = moves[0];
  int best_score = INT_MIN;

  for (int i = 0; i < move_count; i++) {
    make_move(pos, &moves[i]);
    int score = -alphabeta(pos, depth - 1, INT_MIN, INT_MAX);
    unmake_move(pos, &moves[i]);

    // Add randomness if enabled (±randomness)
    if (randomness > 0) {
      // Simple pseudo-random using rand()
      // Note: In production, seed srand() somewhere
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
