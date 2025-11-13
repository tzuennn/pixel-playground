#!/bin/bash

# Build script for Cloud Pixel Playground
# Builds all Docker images for the application

set -e

echo "🏗️  Building Cloud Pixel Playground Docker Images..."
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build Canvas API
echo -e "${BLUE}Building Canvas API...${NC}"
cd "$PROJECT_ROOT/canvas-api"
docker build -t canvas-api:latest .
echo -e "${GREEN}✓ Canvas API built successfully${NC}"
echo ""

# Build WebSocket Gateway
echo -e "${BLUE}Building WebSocket Gateway...${NC}"
cd "$PROJECT_ROOT/websocket-gateway"
docker build -t websocket-gateway:latest .
echo -e "${GREEN}✓ WebSocket Gateway built successfully${NC}"
echo ""

# Build Frontend
echo -e "${BLUE}Building Frontend...${NC}"
cd "$PROJECT_ROOT/frontend"
docker build -t frontend:latest .
echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

echo -e "${GREEN}🎉 All images built successfully!${NC}"
echo ""
echo "Built images:"
docker images | grep -E "canvas-api|websocket-gateway|frontend" | grep latest
