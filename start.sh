#!/bin/bash

# ShatrunZ Startup Script
# Starts both the Flask server and the Game Inspector

echo "🚀 Starting ShatrunZ Backend..."

# Activate virtual environment
source .venv/bin/activate

# Install dependencies if needed
pip install -q -r requirements.txt

# Default UCI binary = Rust drop-in (C sources remain as oracle via make engine-oracle)
if command -v cargo >/dev/null 2>&1; then
  make -s engine-rust || true
fi

# Start Unified Launcher
echo "🚀 Starting ShatrunZ..."
python start.py
