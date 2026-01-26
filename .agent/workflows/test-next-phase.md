---
description: Run verification tests for the current development phase
---
# Test Next Phase Workflow

This workflow ensures regression testing and validates the current phase's objectives.

## 1. Environment Check
```bash
python3 --version
gcc --version
node --version
```

## 2. C Engine Verification
// turbo
```bash
cd engine
make clean
make
./shatrunz_engine << EOF
uci
isready
position startpos
go depth 1
quit
EOF
```

## 3. Python Backend Tests
*Run the specific test suite for the backend logic.*
```bash
# Verify backend can load and communicate with engine
python3 -c "from engine.engine_wrapper import ShatrunZEngine; e = ShatrunZEngine('./engine/shatrunz_engine'); print('Engine Loaded:', e.get_best_move(depth=1)); e.quit()"
```

## 4. Game Rules Verification (Frontend)
*Note: Requires node environment. Placeholder for Jest/Mocha.*
```bash
# Add frontend test command here when ready, e.g., npm test
echo "Frontend tests pending setup"
```

## 5. Krishna Mechanics Check
*Verify Krishna exists and has correct value/type.*
```bash
# Check constants.js for Krishna value
grep "KRISHNA" frontend/constants.js
grep "1200" frontend/constants.js
# Check engine types
grep "KRISHNA = 7" engine/types.h
```

## 6. Tablebase Impact Report (Placeholder)
*Automated check for tablebase config (if any).*
```bash
echo "Tablebase config check: Not configured"
```
