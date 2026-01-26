/*
 * ShatrunZ Chess Engine
 * UCI-compliant chess engine for 9x9 board with Krishna piece
 * Inspired by Stockfish architecture
 */

#ifndef TYPES_H
#define TYPES_H

#include <stdint.h>
#include <stdbool.h>

// Board constants
#define BOARD_SIZE 9
#define MAX_MOVES 256
#define MAX_PLY 128

// Piece types
typedef enum {
    NO_PIECE = 0,
    PAWN = 1,
    KNIGHT = 2,
    BISHOP = 3,
    ROOK = 4,
    QUEEN = 5,
    KING = 6,
    KRISHNA = 7
} PieceType;

// Colors
typedef enum {
    WHITE = 0,
    BLACK = 1,
    NO_COLOR = 2
} Color;

// Piece representation (color + type)
typedef uint8_t Piece;

#define make_piece(color, type) ((Piece)((color << 3) | type))
#define piece_type(piece) ((PieceType)(piece & 7))
#define piece_color(piece) ((Color)(piece >> 3))

// Square representation
typedef int Square;

#define make_square(r, c) ((Square)((r) * BOARD_SIZE + (c)))
#define square_rank(sq) ((sq) / BOARD_SIZE)
#define square_file(sq) ((sq) % BOARD_SIZE)
#define is_valid_square(sq) ((sq) >= 0 && (sq) < BOARD_SIZE * BOARD_SIZE)

// Move representation
typedef struct {
    Square from;
    Square to;
    Piece captured;
    bool is_promotion;
    PieceType promotion_type;
    uint8_t old_castling_rights;
} Move;

// Position structure
typedef struct {
    Piece board[BOARD_SIZE * BOARD_SIZE];
    Color side_to_move;
    int halfmove_clock;
    int fullmove_number;
    uint64_t hash;
    uint8_t castling_rights; // Bitmask: 1=WK, 2=WQ, 4=BK, 8=BQ
} Position;

// Piece values (centipawns)
extern const int PIECE_VALUES[8];

// Direction offsets
extern const int KNIGHT_DIRS[8][2];
extern const int BISHOP_DIRS[4][2];
extern const int ROOK_DIRS[4][2];
extern const int KING_DIRS[8][2];

#endif // TYPES_H
