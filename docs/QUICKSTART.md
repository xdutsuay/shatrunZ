# Quick Start Guide

## 🚀 Starting ShatrunZ Backend

### Stop Current Process
In your terminal, press `Ctrl+C` to stop the current `start.sh`

### Start with Python (Shows All Logs!)
```bash
cd /Users/nehatiwari/localcode/shatrunZ

# Activate virtual environment
source .venv/bin/activate

# Start unified backend
python start.py
```

### What You'll See
```
======================================================================
🚀 SHATRUNZ BACKEND SYSTEM
======================================================================

📁 Data Directory: data/
🎮 Games: data/games/
🧠 Brains: data/brains/
📝 Logs: data/logs/

🌐 Web Interface: http://localhost:8000
👁️  Live Analysis: This terminal

Press Ctrl+C to stop
======================================================================

🌐 Flask Server: Starting on port 8000...
👁️  Game Inspector: Starting...
📁 Monitoring: /Users/nehatiwari/localcode/shatrunZ/data/games
Waiting for games...
```

### Open Browser
http://localhost:8000

### Play/Train
- Click **AIvAI** tab
- Click **Start AI**
- Watch the terminal for live analysis!

## 🎯 What Changed

### 1. Unified Logging
- **Before**: Logs split between server.py and inspector.py
- **Now**: All logs in ONE terminal window!

### 2. Aggressive AI is NOW ULTRA AGGRESSIVE
**New behavior:**
- Material value: 50% (doesn't care much about material)
- Capture bonus: **200-300%** (HUGE!)
- Proximity to enemies: +50% bonus
- Mobility: +10 per move
- **Goal**: Capture EVERYTHING except Krishna and King

**Example evaluation:**
- Normal piece: 500 points
- Same piece with capture available: 500 + (900 * 2) + 900 = **2800 points!**
- Will sacrifice anything to capture

### 3. Krishna Weight Fixed
- Krishna = 1200 (more valuable than Queen)
- Can't be captured, so extremely valuable positionally

## 📊 Expected Results

### Aggressive AI Should Now:
✅ Capture pieces aggressively (even bad trades)
✅ Hunt down enemy pieces
✅ Ignore positional considerations
✅ Create chaotic, tactical games
✅ **Force decisive results** (fewer draws!)

### Terminal Output During Game:
```
============================================================
🔍 ANALYZING GAME: Material AI vs Aggressive AI
📊 Result: 0-1 | Moves: 32
============================================================

📈 INSIGHTS FOR Aggressive AI:
  [AGGRESSIVE]
    ✅ Aggressive AI's attacks were effective
    💡 Suggestion: Maintain attack bonuses

📉 INSIGHTS FOR Material AI:
  [MATERIAL]
    ❌ Material AI failed to defend against aggression
    💡 CRITICAL: Add defensive evaluation
```

## 🎮 Test Scenario

1. **Set up AIvAI**: Material vs Aggressive
2. **Run 5 games**
3. **Check results**: Should see Aggressive winning by capturing everything
4. **Watch terminal**: See live analysis of each game

If Aggressive AI still draws, the inspector will tell us WHY!
