#!/bin/bash

# Cleanup script for Cloud Pixel Playground
# Removes all Kubernetes resources

set -e

echo "🧹 Cleaning up Cloud Pixel Playground from Kubernetes..."
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_ROOT/k8s"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Delete resources in reverse order
echo -e "${BLUE}Deleting Ingress...${NC}"
kubectl delete -f "$K8S_DIR/ingress.yaml" --ignore-not-found=true
echo ""

echo -e "${BLUE}Deleting Frontend...${NC}"
kubectl delete -f "$K8S_DIR/frontend.yaml" --ignore-not-found=true
echo ""

echo -e "${BLUE}Deleting WebSocket Gateway...${NC}"
kubectl delete -f "$K8S_DIR/websocket-gateway.yaml" --ignore-not-found=true
echo ""

echo -e "${BLUE}Deleting Canvas API...${NC}"
kubectl delete -f "$K8S_DIR/canvas-api.yaml" --ignore-not-found=true
echo ""

echo -e "${BLUE}Deleting Redis...${NC}"
kubectl delete -f "$K8S_DIR/redis.yaml" --ignore-not-found=true
echo ""

echo -e "${YELLOW}Waiting for resources to be deleted...${NC}"
sleep 5

echo -e "${GREEN}✓ All resources deleted${NC}"
echo ""

echo "Remaining pods (should be empty):"
kubectl get pods

echo ""
echo -e "${GREEN}🎉 Cleanup completed!${NC}"
