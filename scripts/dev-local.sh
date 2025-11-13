#!/bin/bash

# Local development script
# Runs all services locally without Kubernetes

set -e

echo "🚀 Starting Cloud Pixel Playground locally..."
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start Redis in Docker
echo -e "${BLUE}Starting Redis...${NC}"
docker run -d --name pixel-redis -p 6379:6379 redis:7-alpine redis-server --appendonly yes 2>/dev/null || docker start pixel-redis 2>/dev/null
echo -e "${GREEN}✓ Redis started on port 6379${NC}"
echo ""

# Install dependencies and start Canvas API
echo -e "${BLUE}Starting Canvas API...${NC}"
cd "$PROJECT_ROOT/canvas-api"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
PORT=3001 REDIS_HOST=localhost REDIS_PORT=6379 npm start &
CANVAS_API_PID=$!
echo -e "${GREEN}✓ Canvas API started on port 3001 (PID: $CANVAS_API_PID)${NC}"
echo ""

# Wait for Canvas API to be ready
sleep 3

# Install dependencies and start WebSocket Gateway
echo -e "${BLUE}Starting WebSocket Gateway...${NC}"
cd "$PROJECT_ROOT/websocket-gateway"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
PORT=3002 CANVAS_API_URL=http://localhost:3001 npm start &
WS_GATEWAY_PID=$!
echo -e "${GREEN}✓ WebSocket Gateway started on port 3002 (PID: $WS_GATEWAY_PID)${NC}"
echo ""

# Wait for WebSocket Gateway to be ready
sleep 3

# Install dependencies and start Frontend
echo -e "${BLUE}Starting Frontend...${NC}"
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
PORT=3000 WS_URL=ws://localhost:3002 API_URL=http://localhost:3001 npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started on port 3000 (PID: $FRONTEND_PID)${NC}"
echo ""

# Wait for Frontend to be ready
sleep 3

echo -e "${GREEN}🎉 All services started successfully!${NC}"
echo ""
echo "================================================"
echo "Service URLs:"
echo "================================================"
echo "Frontend:          http://localhost:3000"
echo "Canvas API:        http://localhost:3001"
echo "WebSocket Gateway: ws://localhost:3002"
echo "Redis:             localhost:6379"
echo ""
echo "================================================"
echo "Process IDs:"
echo "================================================"
echo "Canvas API:        $CANVAS_API_PID"
echo "WebSocket Gateway: $WS_GATEWAY_PID"
echo "Frontend:          $FRONTEND_PID"
echo ""
echo "To stop all services:"
echo "  kill $CANVAS_API_PID $WS_GATEWAY_PID $FRONTEND_PID"
echo "  docker stop pixel-redis"
echo ""
echo "Or run: ./scripts/stop-local.sh"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Trap Ctrl+C to cleanup
trap "echo ''; echo 'Stopping services...'; kill $CANVAS_API_PID $WS_GATEWAY_PID $FRONTEND_PID 2>/dev/null; docker stop pixel-redis; echo 'All services stopped.'; exit 0" INT

# Wait for all processes
wait
