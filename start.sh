#!/bin/bash

# ShatrunZ Startup Script
# Starts both the Flask server and the Game Inspector

echo "🚀 Starting ShatrunZ Backend..."

# Activate virtual environment
source .venv/bin/activate

# Install dependencies if needed
pip install -q -r requirements.txt

# Start Flask server in background
echo "🌐 Starting Flask server on port 8000..."
python server.py &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Start Game Inspector
echo "👁️  Starting Game Inspector..."
python inspector.py &
INSPECTOR_PID=$!

echo ""
echo "✅ ShatrunZ Backend Running!"
echo "   Server PID: $SERVER_PID"
echo "   Inspector PID: $INSPECTOR_PID"
echo ""
echo "🌐 Open: http://localhost:8000"
echo "Press Ctrl+C to stop both services"
echo ""

# Wait for Ctrl+C
trap "kill $SERVER_PID $INSPECTOR_PID; exit" INT
wait
