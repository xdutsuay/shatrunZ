# Fairy-Stockfish Integration Plan

## Overview
Fairy-Stockfish is a chess variant engine that can be compiled to WebAssembly and run in the browser. It supports custom variants including our 9x9 ShatrunZ board with Krishna piece.

## Why Fairy-Stockfish?
1. **Much Stronger**: Professional-level chess engine vs our simple minimax
2. **Variant Support**: Can define custom pieces and board sizes
3. **UCI Protocol**: Standard interface for chess engines
4. **WASM**: Runs in browser, no server needed

## Implementation Strategy

### Phase 1: Setup (Current - Simple AI)
✅ JavaScript minimax AI with learning
✅ Multiple strategies (Material, Positional, Aggressive)
✅ Brain-based learning system

### Phase 2: Fairy-Stockfish Integration (Future)

#### Step 1: Get Fairy-Stockfish WASM
```bash
# Clone and build
git clone https://github.com/fairy-stockfish/Fairy-Stockfish
cd Fairy-Stockfish/src
emmake make build ARCH=wasm
```

Or use pre-built:
```
https://github.com/fairy-stockfish/fairy-stockfish.wasm
```

#### Step 2: Define ShatrunZ Variant
Create `variants.ini`:
```ini
[shatrunz:chess]
maxRank = 9
maxFile = 9
startFen = rnbqkbnzr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBNZR w - - 0 1
pieceToCharTable = PNBRQ..........K.......Z.......pnbrq..........k.......z
customPiece1 = z:mK
```

#### Step 3: Create Engine Wrapper
```javascript
// engine.js
class FairyStockfishEngine {
    constructor() {
        this.worker = new Worker('stockfish.js');
        this.ready = false;
        this.callbacks = {};
    }

    async init() {
        return new Promise((resolve) => {
            this.worker.onmessage = (e) => {
                const msg = e.data;
                if (msg === 'readyok') {
                    this.ready = true;
                    resolve();
                }
                this.handleMessage(msg);
            };
            
            // Initialize
            this.send('uci');
            this.send('setoption name UCI_Variant value shatrunz');
            this.send('isready');
        });
    }

    send(cmd) {
        this.worker.postMessage(cmd);
    }

    setPosition(fen, moves = []) {
        let cmd = `position fen ${fen}`;
        if (moves.length > 0) {
            cmd += ` moves ${moves.join(' ')}`;
        }
        this.send(cmd);
    }

    async getBestMove(depth = 10) {
        return new Promise((resolve) => {
            this.callbacks.bestmove = resolve;
            this.send(`go depth ${depth}`);
        });
    }

    handleMessage(msg) {
        if (msg.startsWith('bestmove')) {
            const move = msg.split(' ')[1];
            if (this.callbacks.bestmove) {
                this.callbacks.bestmove(move);
                delete this.callbacks.bestmove;
            }
        }
    }
}
```

#### Step 4: Hybrid AI System
```javascript
// ai.js (updated)
export class AIPlayer {
    constructor(level, strategy, brainName, useEngine = false) {
        this.brain = new GameBrain(brainName);
        this.setLevel(level);
        this.setStrategy(strategy);
        this.useEngine = useEngine;
        this.engine = useEngine ? new FairyStockfishEngine() : null;
    }

    async getBestMove(game, color, fastMode = false) {
        if (this.useEngine && this.engine.ready) {
            // Use Fairy-Stockfish
            const fen = game.toFEN();
            const moves = game.getMoveHistory();
            this.engine.setPosition(fen, moves);
            const uciMove = await this.engine.getBestMove(this.depth * 3);
            return this.parseUCIMove(uciMove);
        } else {
            // Fallback to JS AI
            return this.getJSBestMove(game, color, fastMode);
        }
    }
}
```

## Challenges

### 1. WASM Build Size
- Fairy-Stockfish WASM is ~2-5MB
- Solution: Lazy load only when needed

### 2. Variant Definition
- Need to properly define Krishna piece movement
- Krishna: `mK` (moves like King, non-royal)
- Test with simpler variants first

### 3. Move Notation
- Engine uses UCI format: `e2e4`
- Need to convert to/from our internal format

### 4. Performance
- WASM is fast but has startup cost
- Solution: Initialize engine on page load, keep warm

## Recommended Approach

### Option A: Hybrid (Recommended)
- Keep JS AI for levels 1-3 (fast, good for learning)
- Use Fairy-Stockfish for levels 4-5 (strong, challenging)
- Best of both worlds

### Option B: Full Engine
- Replace JS AI entirely
- Simpler codebase
- Lose learning/brain system

### Option C: Current (What we have)
- Pure JS AI with learning
- Good for development and testing
- Can add engine later

## Next Steps

1. **Test Current System**: Ensure JS AI works well
2. **Tune Evaluation**: Reduce draws, improve play quality
3. **Build WASM**: Compile Fairy-Stockfish for web
4. **Integrate**: Add as optional "Engine Mode"
5. **Compare**: Benchmark JS AI vs Engine

## Recommendation

**Start with Option C (current), then move to Option A (hybrid).**

Reasons:
1. JS AI is working and learning
2. Can tune and improve without engine complexity
3. Engine integration is significant work (~2-3 days)
4. Hybrid gives users choice of speed vs strength

## Current Status

✅ **Phase 1 Complete**: JS AI with learning, multiple strategies
⏳ **Phase 2 Pending**: Fairy-Stockfish integration (future enhancement)

The current system is functional and provides:
- Fast gameplay
- Learning capability
- Multiple AI personalities
- Good for testing and development

Engine integration can be added later when needed for stronger play.
