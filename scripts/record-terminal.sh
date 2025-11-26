#!/bin/bash

# Create log directory if it doesn't exist
mkdir -p ai-log/terminal

# Generate timestamp for log file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOGFILE="ai-log/terminal/session_${TIMESTAMP}.log"

echo "�� Recording terminal session to: $LOGFILE"
echo "To stop recording: type 'exit' or press Ctrl+D"
echo ""

# Start recording
script -q "$LOGFILE"

echo ""
echo "✅ Session saved to: $LOGFILE"
