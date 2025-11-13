#!/bin/bash

# Stop local development services

echo "🛑 Stopping Cloud Pixel Playground services..."

# Kill Node.js processes
pkill -f "node.*canvas-api"
pkill -f "node.*websocket-gateway"
pkill -f "node.*frontend"

# Stop Redis container
docker stop pixel-redis 2>/dev/null

echo "✓ All services stopped"
