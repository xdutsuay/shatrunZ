# ShatrunZ Advanced AI System - Implementation Complete

## 🎯 Features Implemented

### 1. Multiple AI Personalities
- **Material AI**: Focuses on piece values + center control + pawn advancement
- **Positional AI**: Uses piece-square tables, king safety, mobility evaluation
- **Aggressive AI**: Prioritizes attacks, captures, and threats to enemy king

### 2. Dual AI System for AIvAI
- AI1 (Material Strategy) vs AI2 (Positional Strategy)
- Each AI has its own brain and learning system
- Cross-learning: AIs learn from playing against each other

### 3. Persistent Brain Storage
- Brain data stored in localStorage (survives browser refresh)
- Auto-export to JSON file every 10 games
- Manual export/import functionality
- Stats tracking: wins, losses, draws, total games
- Memory size tracking (positions learned)

### 4. PGN Recording & Management
- Live move recording in algebraic notation
- Game history browser (last 50 games)
- PGN export for current and historical games
- Move list display in sidebar
- Automatic game archiving

### 5. Enhanced UI
- **Move List Panel**: Shows current game moves (e.g., "1. e4 e5 2. Nf3")
- **Game History**: Dropdown to browse and load previous games
- **Brain Stats**: Displays learning progress for both AIs
- **Strategy Selector**: Choose AI personality for PvAI mode
- **Brain Management**: Export, import, and reset brain data

## 📁 File Structure

```
html/
├── constants.js      # Shared constants
├── rules.js          # Chess rules and move validation
├── game.js           # Game state management
├── brain.js          # NEW: Persistent learning system
├── pgn.js            # NEW: Game recording & PGN export
├── ai.js             # UPDATED: Multiple AI strategies
├── ui.js             # UPDATED: Dual AI support, PGN display
├── main.js           # Entry point
├── index.html        # UPDATED: New UI sections
└── style.css         # UPDATED: Styling for new features
```

## 🎮 How to Use

### Playing Against AI
1. Click **PvAI** tab
2. Select AI **Strategy** (Material/Positional/Aggressive)
3. Choose your side (White/Black)
4. Click **Start AI** to begin

### Watching AI vs AI
1. Click **AIvAI** tab
2. Click **Start AI**
3. Watch Material AI (White) vs Positional AI (Black)
4. AIs will learn from each game

### Hyper-Training
1. Click **⚡ Hyper-Train (50 Games)**
2. AIs will play 50 games against each other at high speed
3. Progress bar shows training status
4. Brain memory automatically exported every 10 games

### Managing Brain Data
- **Export Brain**: Download both AI brains as JSON
- **Import Brain**: Load previously saved brain data
- **Reset Brain**: Clear all learning (requires confirmation)

### Viewing Game History
- **Moves Panel**: See current game notation
- **Game History**: Browse last 50 games
- **Export PGN**: Download current game in PGN format
- **Load Selected**: View details of historical games

## 🧠 Learning System

### How AIs Learn
1. During gameplay, each move is recorded with board state hash
2. When game ends, moves are rewarded/penalized:
   - **Win**: +10 points (decaying for last 10 moves)
   - **Loss**: -10 points
   - **Draw**: -2 points
3. Future move selection considers learned bonuses
4. Memory persists across sessions via localStorage

### Cross-Learning in AIvAI
- Winner reinforces successful strategies
- Loser learns to avoid losing patterns
- Both AIs evolve different playing styles
- Diversity in strategies leads to richer learning

## 📊 Stats Tracking

Brain stats display shows:
```
Material: 1234 pos | W:45 L:32 D:23
Positional: 987 pos | W:38 L:41 D:21
```

- **pos**: Number of unique positions learned
- **W/L/D**: Win/Loss/Draw record

## 🔧 Technical Details

### PGN Format
Games are recorded in standard PGN format:
```
[Event "ShatrunZ Game"]
[Site "Web Browser"]
[Date "2025-12-04"]
[White "Material AI"]
[Black "Positional AI"]
[Result "1-0"]
[Variant "9x9 ShatrunZ"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...
```

### Storage
- Brain data: `localStorage` key `shatrunz_brain_{name}_v3`
- Game history: `localStorage` key `shatrunz_pgn_history`
- Auto-export: Downloads JSON files to browser's download folder

### Performance
- AI yields control every 30ms to keep UI responsive
- Hyper-training runs at reduced depth for speed
- Move list auto-scrolls to show latest moves

## 🐛 Known Limitations

1. **En passant**: Not implemented. **Castling** is implemented in both JS (`frontend/rules.js`) and C (`engine/position.c`); JS is the rules-of-record if engines disagree (see `docs/engine_roles.md`).
2. **PGN Replay**: Can view but not replay moves on board yet
3. **50-move Rule**: Not enforced
4. **Storage Limit**: localStorage has ~5-10MB limit per domain

## 🚀 Future Enhancements

1. **Fairy-Stockfish Integration**: Use WASM engine for stronger play
2. **Move Replay**: Click moves to navigate game history
3. **Opening Book**: Pre-trained positions for better early game
4. **ELO Rating**: Track AI strength over time
5. **Cloud Sync**: Save brains to server for cross-device access
