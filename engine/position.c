/*
 * Position management and move generation
 */

#include "types.h"
#include <stdio.h>
#include <stdlib.h> // for abs()
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
  pos->castling_rights = 15; // All rights: 1|2|4|8
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

  // Check king attacks (Krishna does not give check)
  for (int i = 0; i < 8; i++) {
    int nr = r + KING_DIRS[i][0];
    int nc = c + KING_DIRS[i][1];
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      Square nsq = make_square(nr, nc);
      Piece p = pos->board[nsq];
      if (p != NO_PIECE && piece_color(p) == by_color) {
        PieceType pt = piece_type(p);
        if (pt == KING) {
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
  // Store old rights
  ((Move *)move)->old_castling_rights = pos->castling_rights;

  Piece piece = pos->board[move->from];
  pos->board[move->to] = piece;
  pos->board[move->from] = NO_PIECE;

  // Handle promotion
  if (move->is_promotion) {
    pos->board[move->to] = make_piece(pos->side_to_move, move->promotion_type);
  }

  // Handle Castling (King moves 2 squares)
  if (piece_type(piece) == KING && abs(move->to - move->from) == 2) {
    int r = square_rank(move->to);
    bool kingside = (move->to > move->from);
    // Move Rook
    Square rook_from = make_square(r, kingside ? 8 : 0);
    Square rook_to =
        make_square(r, kingside ? 5 : 3); // G(6) is King, F(5) is Rook? No.
    // 9x9 Layout:
    // Index: 0 1 2 3 4 5 6 7 8
    // Files: A B C D E F G H I
    // King at E(4). Moves to C(2) [Queenside] or G(6) [Kingside].
    // Queenside Rook at A(0). Moves to D(3).
    // Kingside Rook at I(8). Moves to F(5).
    rook_to = make_square(r, kingside ? 5 : 3); // F or D

    Piece rook = pos->board[rook_from];
    pos->board[rook_to] = rook;
    pos->board[rook_from] = NO_PIECE;
  }

  // Update Castling Rights
  if (piece_type(piece) == KING) {
    if (pos->side_to_move == WHITE)
      pos->castling_rights &= ~3; // Clear WK, WQ
    else
      pos->castling_rights &= ~12; // Clear BK, BQ
  }
  // Rook moves or is captured (simplified: just check from square)
  // White Rooks start at 72 (A1), 80 (I1)? Wait, Rank 1 is index 8.
  // Rank 8 indices: 8*9=72 to 80.
  // A1=72, I1=80.
  // Black Rooks: A9=0, I9=8.
  if (move->from == 72 || move->to == 72)
    pos->castling_rights &= ~2; // WQ
  if (move->from == 80 || move->to == 80)
    pos->castling_rights &= ~1; // WK
  if (move->from == 0 || move->to == 0)
    pos->castling_rights &= ~8; // BQ
  if (move->from == 8 || move->to == 8)
    pos->castling_rights &= ~4; // BK

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

  // Handle Castling (Undo Rook move)
  if (piece_type(piece) == KING && abs(move->to - move->from) == 2) {
    int r = square_rank(move->to);
    bool kingside = (move->to > move->from);
    Square rook_from = make_square(r, kingside ? 8 : 0);
    Square rook_to = make_square(r, kingside ? 5 : 3);

    Piece rook = pos->board[rook_to];
    pos->board[rook_from] = rook;
    pos->board[rook_to] = NO_PIECE;
  }

  // Restore Castling Rights
  pos->castling_rights = move->old_castling_rights;

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
            moves[count++] =
                (Move){from, to, NO_PIECE, true, promos[i], 0};
          }
        } else {
          moves[count++] = (Move){from, to, NO_PIECE, false, NO_PIECE, 0};
        }

        // Double move from start
        if (r == start_rank) {
          to = make_square(r + 2 * dir, c);
          if (pos->board[to] == NO_PIECE) {
            moves[count++] = (Move){from, to, NO_PIECE, false, NO_PIECE, 0};
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
                moves[count++] =
                    (Move){from, to, captured, true, promos[i], 0};
              }
            } else {
              moves[count++] = (Move){from, to, captured, false, NO_PIECE, 0};
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
            moves[count++] = (Move){from, to, captured, false, NO_PIECE, 0};
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
            moves[count++] = (Move){from, to, NO_PIECE, false, NO_PIECE, 0};
          } else {
            if (piece_color(captured) == them &&
                piece_type(captured) != KRISHNA) {
              moves[count++] = (Move){from, to, captured, false, NO_PIECE, 0};
            }
            break;
          }
        }
      }
    }
    // King and Krishna moves (same movement pattern; Krishna cannot capture)
    else if (pt == KING || pt == KRISHNA) {
      for (int i = 0; i < 8; i++) {
        int nr = r + KING_DIRS[i][0];
        int nc = c + KING_DIRS[i][1];
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          Square to = make_square(nr, nc);
          Piece captured = pos->board[to];
          if (pt == KRISHNA) {
            // Krishna is non-capturing: it can only move to empty squares.
            if (captured == NO_PIECE) {
              moves[count++] = (Move){from, to, NO_PIECE, false, NO_PIECE, 0};
            }
          } else {
            if (captured == NO_PIECE || (piece_color(captured) == them &&
                                         piece_type(captured) != KRISHNA)) {
              moves[count++] = (Move){from, to, captured, false, NO_PIECE, 0};
            }
          }
        }
      }

      // Castling (King only)
      if (pt == KING && !is_in_check(pos, us)) {
        int r_idx = (us == WHITE) ? 8 : 0; // Rank index

        // Kingside (Rights 1/4)
        if (pos->castling_rights & ((us == WHITE) ? 1 : 4)) {
          // Path: F(5), G(6) must be empty (Z is at G normally, so this checks
          // if Z moved) Wait, destination is G(6), path is F(5). King E(4) ->
          // F(5) -> G(6). Need F(5) and G(6) empty. Also squares E(4), F(5),
          // G(6) cannot be attacked.
          Square rook_sq = make_square(r_idx, 8);
          Piece rook = pos->board[rook_sq];
          if (rook != NO_PIECE && piece_color(rook) == us &&
              piece_type(rook) == ROOK &&
              pos->board[make_square(r_idx, 5)] == NO_PIECE &&
              pos->board[make_square(r_idx, 6)] == NO_PIECE) {
            if (!is_square_attacked(pos, make_square(r_idx, 5), them) &&
                !is_square_attacked(pos, make_square(r_idx, 6), them)) {
              moves[count++] = (Move){from, make_square(r_idx, 6), NO_PIECE,
                                      false, NO_PIECE, 0};
            }
          }
        }

        // Queenside (Rights 2/8)
        if (pos->castling_rights & ((us == WHITE) ? 2 : 8)) {
          // Path: D(3), C(2), B(1).
          // King E(4) -> D(3) -> C(2).
          // Need D(3), C(2), B(1) empty (Rook is at A(0) and jumps to D(3)).
          // Wait, King lands on C(2).
          // Path squares: D(3), C(2).
          // Does B(1) need to be empty? Yes, for Rook at A(0) to move to D(3).
          // Standard chess: Path between King and Rook must be empty.
          // Here: Squares 1, 2, 3 must be empty.
          Square rook_sq = make_square(r_idx, 0);
          Piece rook = pos->board[rook_sq];
          if (rook != NO_PIECE && piece_color(rook) == us &&
              piece_type(rook) == ROOK &&
              pos->board[make_square(r_idx, 3)] == NO_PIECE &&
              pos->board[make_square(r_idx, 2)] == NO_PIECE &&
              pos->board[make_square(r_idx, 1)] == NO_PIECE) {
            if (!is_square_attacked(pos, make_square(r_idx, 3), them) &&
                !is_square_attacked(pos, make_square(r_idx, 2), them)) {
              moves[count++] = (Move){from, make_square(r_idx, 2), NO_PIECE,
                                      false, NO_PIECE, 0};
            }
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
