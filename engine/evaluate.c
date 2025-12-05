/*
 * Position evaluation
 */

#include "types.h"
#include <stdlib.h>

// Simple material evaluation
int evaluate_material(const Position *pos) {
  int score = 0;

  for (Square sq = 0; sq < BOARD_SIZE * BOARD_SIZE; sq++) {
    Piece p = pos->board[sq];
    if (p != NO_PIECE) {
      int value = PIECE_VALUES[piece_type(p)];
      if (piece_color(p) == WHITE) {
        score += value;
      } else {
        score -= value;
      }
    }
  }

  return score;
}

// Evaluate position from side to move's perspective
int evaluate(const Position *pos) {
  int score = evaluate_material(pos);

  // Return from side to move's perspective
  return (pos->side_to_move == WHITE) ? score : -score;
}
