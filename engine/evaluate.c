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

// Piece-Square Tables (9x9)
// Oriented for WHITE (Rank 8 at bottom, Rank 0 at top)
// For BLACK, we mirror the rank.

// Pawns: encourage advancing.
const int PST_PAWN[81] = {
    0,  0,  0,   0,   0,   0,   0,   0,  0,  // Rank 0 (Promotion)
    50, 50, 50,  50,  50,  50,  50,  50, 50, // Rank 1
    10, 10, 20,  30,  30,  30,  20,  10, 10, // Rank 2
    5,  5,  10,  25,  30,  25,  10,  5,  5,  // Rank 3
    0,  0,  0,   20,  25,  20,  0,   0,  0,  // Rank 4
    5,  -5, -10, 0,   0,   0,   -10, -5, 5,  // Rank 5
    5,  10, 10,  -20, -20, -20, 10,  10, 5,  // Rank 6
    0,  0,  0,   0,   0,   0,   0,   0,  0,  // Rank 7 (Start)
    0,  0,  0,   0,   0,   0,   0,   0,  0   // Rank 8
};

// Knights: Centralize. Avoid edges.
const int PST_KNIGHT[81] = {
    -50, -40, -30, -30, -30, -30, -30, -40, -50, -40, -20, 0,   0,   0,
    0,   0,   -20, -40, -30, 0,   10,  15,  15,  15,  10,  0,   -30, -30,
    5,   15,  20,  20,  20,  15,  5,   -30, -30, 0,   15,  20,  20,  20,
    15,  0,   -30, -30, 5,   10,  15,  15,  15,  10,  5,   -30, -40, -20,
    0,   5,   5,   5,   0,   -20, -40, -50, -40, -30, -30, -30, -30, -30,
    -40, -50, -50, -40, -30, -30, -30, -30, -30, -40, -50};

// Krishna: Bonus for Center (Strategic Blockade) + King Shield (Safe)
// Indestructible, so center is very powerful.
const int PST_KRISHNA[81] = {
    -20, -20, -20, -20, -20, -20, -20, -20, -20, // Enemy back rank? Good for
                                                 // annoyance, but risky if
                                                 // trapped (can't be captured
                                                 // but can be walled)
    -10, 0,   0,   0,   0,   0,   0,   0,   -10, -10, 0,  10, 10,
    10,  10,  10,  0,   -10, -10, 5,   10,  20,  20,  20, 10, 5,
    -10, -10, 5,   10,  20,  40,  20,  10,  5,   -10, // Center E5 massive bonus
    -10, 5,   10,  20,  20,  20,  10,  5,   -10, -10, 0,  10, 10,
    10,  10,  10,  0,   -10, -20, -10, 0,   0,   0,   0,  0,  -10,
    -20, -30, -20, -10, -10, 0,   -10, -10, -20, -30};

// King: Safety in corners/behind pawns
const int PST_KING[81] = {
    -30, -40, -40, -50, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50,
    -50, -40, -40, -30, -30, -40, -40, -50, -50, -50, -40, -40, -30, -30,
    -40, -40, -50, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -40,
    -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -20, -10, 20,  20,
    0,   0,   0,   0,   0,   20,  20,  20,  30,  10,  0,   0,   0,   10,
    30,  20,  20,  30,  10,  0,   0,   0,   10,  30,  20 // Back rank safety
};

// Evaluate position from side to move's perspective
int evaluate(const Position *pos) {
  int score = 0;

  for (Square sq = 0; sq < BOARD_SIZE * BOARD_SIZE; sq++) {
    Piece p = pos->board[sq];
    if (p != NO_PIECE) {
      PieceType pt = piece_type(p);
      Color col = piece_color(p);
      int value = PIECE_VALUES[pt];

      // PST lookup
      int pst_val = 0;
      int r = square_rank(sq);
      int c = square_file(sq);
      int table_idx =
          (col == WHITE) ? sq : (8 - r) * 9 + c; // Mirror rank for Black

      if (pt == PAWN)
        pst_val = PST_PAWN[table_idx];
      else if (pt == KNIGHT)
        pst_val = PST_KNIGHT[table_idx];
      else if (pt == KRISHNA)
        pst_val = PST_KRISHNA[table_idx];
      else if (pt == KING)
        pst_val = PST_KING[table_idx];
      // Add others... (Rook/Bishop/Queen usually simple centralization or
      // mobility, skip for now to save space)

      if (col == WHITE) {
        score += value + pst_val;
      } else {
        score -= (value + pst_val);
      }
    }
  }

  // Return from side to move's perspective
  return (pos->side_to_move == WHITE) ? score : -score;
}
