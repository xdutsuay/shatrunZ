#!/bin/bash

# ShatrunZ Startup Script
# Starts both the Flask server and the Game Inspector

echo "🚀 Starting ShatrunZ Backend..."

# Activate virtual environment
source .venv/bin/activate

# Install dependencies if needed
pip install -q -r requirements.txt

# Start Unified Launcher
echo "🚀 Starting ShatrunZ..."
python start.py
