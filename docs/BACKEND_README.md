# ShatrunZ Backend System

## 🎯 What This Does

### 1. **Flask Server** (`server.py`)
- Serves the web app on `http://localhost:5000`
- Handles file storage (no more browser downloads!)
- Saves games to `data/games/`
- Saves AI brains to `data/brains/`
- Provides REST API for frontend

### 2. **Game Inspector** (`inspector.py`)
- Runs continuously in terminal
- Analyzes every completed game
- Provides real-time insights
- Suggests improvements for each AI persona
- Logs analysis to `data/logs/`

### 3. **Key Improvements**

#### Krishna Weight Fixed
- **Before**: Krishna = 0 (worthless!)
- **Now**: Krishna = 1200 (more than Queen!)
- **Why**: Can't be captured, so it's extremely valuable positionally

#### Backend File Storage
- Games saved to: `data/games/game_TIMESTAMP.pgn`
- Brains saved to: `data/brains/brain_NAME_latest.json`
- No more browser downloads during training!

#### Live Game Analysis
The inspector watches games and provides insights like:

```
🔍 ANALYZING GAME: Material AI vs Positional AI
📊 Result: 1/2-1/2 | Moves: 87

📈 INSIGHTS FOR Material AI:
  [ENDGAME]
    ⚠️  DRAW - Endgame technique needs improvement!
    💡 CRITICAL: Add passed pawn bonuses (+200)
    💡 CRITICAL: Add king activity in endgame (+50)

📉 INSIGHTS FOR Positional AI:
  [MISTAKES]
    🔴 MAJOR ISSUE: Draw by repetition
    💡 FIX: Add repetition avoidance logic
```

## 🚀 How to Use

### Installation
```bash
cd /Users/nehatiwari/localcode/shatrunZ

# Install Python dependencies
pip install -r requirements.txt

# Make start script executable
chmod +x start.sh
```

### Start the System
```bash
# Option 1: Use the startup script (recommended)
./start.sh

# Option 2: Manual start
# Terminal 1:
python server.py

# Terminal 2:
python inspector.py
```

### Access the App
1. Open browser: `http://localhost:5000`
2. Play games or run hyper-training
3. Watch terminal for live analysis!

### Stop the System
Press `Ctrl+C` in the terminal

## 📁 Directory Structure

```
shatrunZ/
├── server.py           # Flask backend
├── inspector.py        # Game analyzer
├── start.sh           # Startup script
├── requirements.txt   # Python deps
├── html/              # Frontend files
│   ├── api.js         # NEW: Backend API client
│   ├── constants.js   # UPDATED: Krishna weight = 1200
│   └── ...
└── data/              # Created automatically
    ├── games/         # PGN files + metadata
    ├── brains/        # AI brain snapshots
    └── logs/          # Analysis logs
```

## 🎮 What Happens During a Game

1. **Game Starts**: Frontend initializes
2. **Moves Made**: Recorded in PGN format
3. **Game Ends**: 
   - Frontend sends game data to backend
   - Backend saves PGN file
   - Backend triggers analysis
4. **Inspector Analyzes**:
   - Detects new game
   - Analyzes moves and result
   - Prints insights to terminal
   - Saves log file
5. **Next Game**: Insights help improve AI

## 🧠 Inspector Insights

The inspector provides persona-specific advice:

### For Material AI:
- ✅ "Successfully converted material advantage"
- ❌ "Failed to convert advantage - improve endgame"
- 💡 "Add 'winning when ahead' logic"

### For Positional AI:
- ✅ "Piece placement was superior"
- ❌ "Setup was insufficient"
- 💡 "Increase king safety weight"

### For Aggressive AI:
- ✅ "Attacks were effective"
- ❌ "Overextended - balance aggression"
- 💡 "Add king safety check before attacking"

### General (All AIs):
- 🔴 "MAJOR ISSUE: Draw by repetition"
- 💡 "CRITICAL: Add passed pawn bonuses"
- 💡 "FIX: Avoid repetition when ahead"

## 🔧 Next Steps

After running some games and seeing the inspector's suggestions, we can:

1. **Implement Suggested Improvements**
   - Add passed pawn bonuses
   - Add king activity in endgame
   - Add repetition avoidance
   - Improve trade logic

2. **Monitor Progress**
   - Watch win/loss/draw ratios
   - See if suggestions reduce draws
   - Iterate based on inspector feedback

3. **Advanced Features**
   - Inspector could auto-tune weights
   - Machine learning from game corpus
   - Opening book generation

## 📊 Expected Results

With Krishna weight fixed (0 → 1200):
- AIs will value Krishna pieces correctly
- Better positional play around Krishna
- More strategic depth

With backend analysis:
- Clear feedback on what's working/failing
- Data-driven improvements
- Faster iteration cycle

## 🎯 Goal

Reduce draws from ~60% to <20% by:
1. Krishna weight fix (immediate)
2. Inspector-guided improvements (iterative)
3. Better endgame evaluation (next step)
