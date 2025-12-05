# ShatrunZ C Engine Makefile

CC = gcc
CFLAGS = -O3 -Wall -Wextra -std=c99
TARGET = shatrunz_engine

SRCS = uci.c position.c search.c evaluate.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c types.h
	$(CC) $(CFLAGS) -c $<

clean:
	rm -f $(OBJS) $(TARGET)

test: $(TARGET)
	@echo "Testing UCI protocol..."
	@echo "uci" | ./$(TARGET)
	@echo "isready" | ./$(TARGET)

.PHONY: all clean test
