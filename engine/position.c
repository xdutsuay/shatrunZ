/*
 * Position management and move generation
 */

#include "types.h"
#include <stdio.h>
#include <string.h>

// Piece values
const int PIECE_VALUES[8] = {
    0,     // NO_PIECE
    100,   // PAWN
    320,   // KNIGHT
    330,   // BISHOP
    500,   // ROOK
    900,   // QUEEN
    20000, // KING
    1200   // KRISHNA (more valuable than Queen!)
};

// Direction offsets
const int KNIGHT_DIRS[8][2] = {{-2, -1}, {-2, 1}, {-1, -2}, {-1, 2},
                               {1, -2},  {1, 2},  {2, -1},  {2, 1}};

const int BISHOP_DIRS[4][2] = {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}};

const int ROOK_DIRS[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};

const int KING_DIRS[8][2] = {{-1, -1}, {-1, 0}, {-1, 1}, {0, -1},
                             {0, 1},   {1, -1}, {1, 0},  {1, 1}};

// Initialize position to starting position
void init_position(Position *pos) {
  memset(pos, 0, sizeof(Position));

  // Back rank setup: R N B Q K B Z N R
  Piece white_back[] = {make_piece(WHITE, ROOK),    make_piece(WHITE, KNIGHT),
                        make_piece(WHITE, BISHOP),  make_piece(WHITE, QUEEN),
                        make_piece(WHITE, KING),    make_piece(WHITE, BISHOP),
                        make_piece(WHITE, KRISHNA), make_piece(WHITE, KNIGHT),
                        make_piece(WHITE, ROOK)};

  // Setup board
  for (int c = 0; c < BOARD_SIZE; c++) {
    // Black pieces (rank 0)
    pos->board[make_square(0, c)] =
        make_piece(BLACK, piece_type(white_back[c]));
    // Black pawns (rank 1)
    pos->board[make_square(1, c)] = make_piece(BLACK, PAWN);
    // White pawns (rank 7)
    pos->board[make_square(7, c)] = make_piece(WHITE, PAWN);
    // White pieces (rank 8)
    pos->board[make_square(8, c)] = white_back[c];
  }

  pos->side_to_move = WHITE;
  pos->halfmove_clock = 0;
  pos->fullmove_number = 1;
}

// Check if square is attacked by given color
bool is_square_attacked(const Position *pos, Square sq, Color by_color) {
  int r = square_rank(sq);
  int c = square_file(sq);

  // Check knight attacks
  for (int i = 0; i < 8; i++) {
    int nr = r + KNIGHT_DIRS[i][0];
    int nc = c + KNIGHT_DIRS[i][1];
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      Square nsq = make_square(nr, nc);
      Piece p = pos->board[nsq];
      if (p != NO_PIECE && piece_color(p) == by_color &&
          piece_type(p) == KNIGHT) {
        return true;
      }
    }
  }

  // Check sliding pieces (bishop, rook, queen)
  const int(*dirs[])[2] = {BISHOP_DIRS, ROOK_DIRS};
  int dir_counts[] = {4, 4};

  for (int d = 0; d < 2; d++) {
    for (int i = 0; i < dir_counts[d]; i++) {
      int nr = r, nc = c;
      while (true) {
        nr += dirs[d][i][0];
        nc += dirs[d][i][1];
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE)
          break;

        Square nsq = make_square(nr, nc);
        Piece p = pos->board[nsq];
        if (p != NO_PIECE) {
          if (piece_color(p) == by_color) {
            PieceType pt = piece_type(p);
            if (pt == QUEEN || (d == 0 && pt == BISHOP) ||
                (d == 1 && pt == ROOK)) {
              return true;
            }
          }
          break;
        }
      }
    }
  }

  // Check king/krishna attacks
  for (int i = 0; i < 8; i++) {
    int nr = r + KING_DIRS[i][0];
    int nc = c + KING_DIRS[i][1];
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      Square nsq = make_square(nr, nc);
      Piece p = pos->board[nsq];
      if (p != NO_PIECE && piece_color(p) == by_color) {
        PieceType pt = piece_type(p);
        if (pt == KING || pt == KRISHNA) {
          return true;
        }
      }
    }
  }

  // Check pawn attacks
  int pawn_dir = (by_color == WHITE) ? -1 : 1;
  for (int dc = -1; dc <= 1; dc += 2) {
    int nr = r + pawn_dir;
    int nc = c + dc;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      Square nsq = make_square(nr, nc);
      Piece p = pos->board[nsq];
      if (p != NO_PIECE && piece_color(p) == by_color &&
          piece_type(p) == PAWN) {
        return true;
      }
    }
  }

  return false;
}

// Find king square for given color
Square find_king(const Position *pos, Color color) {
  for (Square sq = 0; sq < BOARD_SIZE * BOARD_SIZE; sq++) {
    Piece p = pos->board[sq];
    if (p != NO_PIECE && piece_color(p) == color && piece_type(p) == KING) {
      return sq;
    }
  }
  return -1; // Should never happen
}

// Check if king is in check
bool is_in_check(const Position *pos, Color color) {
  Square king_sq = find_king(pos, color);
  if (king_sq < 0)
    return false;
  return is_square_attacked(pos, king_sq, color == WHITE ? BLACK : WHITE);
}

// Make a move
void make_move(Position *pos, const Move *move) {
  Piece piece = pos->board[move->from];
  pos->board[move->to] = piece;
  pos->board[move->from] = NO_PIECE;

  // Handle promotion
  if (move->is_promotion) {
    pos->board[move->to] = make_piece(pos->side_to_move, move->promotion_type);
  }

  // Update game state
  pos->side_to_move = (pos->side_to_move == WHITE) ? BLACK : WHITE;
  pos->halfmove_clock++;
  if (pos->side_to_move == WHITE) {
    pos->fullmove_number++;
  }
}

// Unmake a move
void unmake_move(Position *pos, const Move *move) {
  Piece piece = pos->board[move->to];

  // Handle promotion (restore pawn)
  if (move->is_promotion) {
    piece = make_piece(piece_color(piece), PAWN);
  }

  pos->board[move->from] = piece;
  pos->board[move->to] = move->captured;

  // Restore game state
  pos->side_to_move = (pos->side_to_move == WHITE) ? BLACK : WHITE;
  pos->halfmove_clock--;
  if (pos->side_to_move == BLACK) {
    pos->fullmove_number--;
  }
}

// Generate all pseudo-legal moves
int generate_moves(const Position *pos, Move *moves) {
  int count = 0;
  Color us = pos->side_to_move;
  Color them = (us == WHITE) ? BLACK : WHITE;

  for (Square from = 0; from < BOARD_SIZE * BOARD_SIZE; from++) {
    Piece piece = pos->board[from];
    if (piece == NO_PIECE || piece_color(piece) != us)
      continue;

    PieceType pt = piece_type(piece);
    int r = square_rank(from);
    int c = square_file(from);

    // Pawn moves
    if (pt == PAWN) {
      int dir = (us == WHITE) ? -1 : 1;
      int start_rank = (us == WHITE) ? 7 : 1;
      int promo_rank = (us == WHITE) ? 0 : 8;

      // Forward move
      Square to = make_square(r + dir, c);
      if (is_valid_square(to) && pos->board[to] == NO_PIECE) {
        bool is_promo = (square_rank(to) == promo_rank);
        if (is_promo) {
          // Generate all promotion moves
          PieceType promos[] = {QUEEN, ROOK, BISHOP, KNIGHT};
          for (int i = 0; i < 4; i++) {
            moves[count++] = (Move){from, to, NO_PIECE, true, promos[i]};
          }
        } else {
          moves[count++] = (Move){from, to, NO_PIECE, false, NO_PIECE};
        }

        // Double move from start
        if (r == start_rank) {
          to = make_square(r + 2 * dir, c);
          if (pos->board[to] == NO_PIECE) {
            moves[count++] = (Move){from, to, NO_PIECE, false, NO_PIECE};
          }
        }
      }

      // Captures
      for (int dc = -1; dc <= 1; dc += 2) {
        to = make_square(r + dir, c + dc);
        if (is_valid_square(to)) {
          Piece captured = pos->board[to];
          if (captured != NO_PIECE && piece_color(captured) == them &&
              piece_type(captured) != KRISHNA) { // Can't capture Krishna!
            bool is_promo = (square_rank(to) == promo_rank);
            if (is_promo) {
              PieceType promos[] = {QUEEN, ROOK, BISHOP, KNIGHT};
              for (int i = 0; i < 4; i++) {
                moves[count++] = (Move){from, to, captured, true, promos[i]};
              }
            } else {
              moves[count++] = (Move){from, to, captured, false, NO_PIECE};
            }
          }
        }
      }
    }
    // Knight moves
    else if (pt == KNIGHT) {
      for (int i = 0; i < 8; i++) {
        int nr = r + KNIGHT_DIRS[i][0];
        int nc = c + KNIGHT_DIRS[i][1];
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          Square to = make_square(nr, nc);
          Piece captured = pos->board[to];
          if (captured == NO_PIECE || (piece_color(captured) == them &&
                                       piece_type(captured) != KRISHNA)) {
            moves[count++] = (Move){from, to, captured, false, NO_PIECE};
          }
        }
      }
    }
    // Sliding pieces (Bishop, Rook, Queen)
    else if (pt == BISHOP || pt == ROOK || pt == QUEEN) {
      const int(*dirs)[2];
      int dir_count;

      if (pt == BISHOP) {
        dirs = BISHOP_DIRS;
        dir_count = 4;
      } else if (pt == ROOK) {
        dirs = ROOK_DIRS;
        dir_count = 4;
      } else { // QUEEN
        static const int queen_dirs[8][2] = {{-1, -1}, {-1, 0}, {-1, 1},
                                             {0, -1},  {0, 1},  {1, -1},
                                             {1, 0},   {1, 1}};
        dirs = queen_dirs;
        dir_count = 8;
      }

      for (int i = 0; i < dir_count; i++) {
        int nr = r, nc = c;
        while (true) {
          nr += dirs[i][0];
          nc += dirs[i][1];
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE)
            break;

          Square to = make_square(nr, nc);
          Piece captured = pos->board[to];

          if (captured == NO_PIECE) {
            moves[count++] = (Move){from, to, NO_PIECE, false, NO_PIECE};
          } else {
            if (piece_color(captured) == them &&
                piece_type(captured) != KRISHNA) {
              moves[count++] = (Move){from, to, captured, false, NO_PIECE};
            }
            break;
          }
        }
      }
    }
    // King and Krishna moves (same movement pattern)
    else if (pt == KING || pt == KRISHNA) {
      for (int i = 0; i < 8; i++) {
        int nr = r + KING_DIRS[i][0];
        int nc = c + KING_DIRS[i][1];
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          Square to = make_square(nr, nc);
          Piece captured = pos->board[to];
          if (captured == NO_PIECE || (piece_color(captured) == them &&
                                       piece_type(captured) != KRISHNA)) {
            moves[count++] = (Move){from, to, captured, false, NO_PIECE};
          }
        }
      }
    }
  }

  return count;
}

// Generate only legal moves (filter out moves that leave king in check)
int generate_legal_moves(Position *pos, Move *moves) {
  Move pseudo_moves[MAX_MOVES];
  int pseudo_count = generate_moves(pos, pseudo_moves);

  int count = 0;
  for (int i = 0; i < pseudo_count; i++) {
    make_move(pos, &pseudo_moves[i]);

    // Check if our king is in check after this move
    Color us = (pos->side_to_move == WHITE) ? BLACK : WHITE;
    if (!is_in_check(pos, us)) {
      moves[count++] = pseudo_moves[i];
    }

    unmake_move(pos, &pseudo_moves[i]);
  }

  return count;
}
