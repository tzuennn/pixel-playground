#!/bin/bash

# Deploy script for Cloud Pixel Playground
# Deploys all Kubernetes resources

set -e

echo "🚀 Deploying Cloud Pixel Playground to Kubernetes..."
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

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Please check your configuration."
    exit 1
fi

echo -e "${GREEN}✓ Kubernetes cluster is accessible${NC}"
echo ""

# Deploy Redis (Database)
echo -e "${BLUE}Deploying Redis StatefulSet...${NC}"
kubectl apply -f "$K8S_DIR/redis.yaml"
echo -e "${GREEN}✓ Redis deployed${NC}"
echo ""

# Wait for Redis to be ready
echo -e "${YELLOW}Waiting for Redis to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=redis --timeout=120s
echo -e "${GREEN}✓ Redis is ready${NC}"
echo ""

# Deploy Canvas API
echo -e "${BLUE}Deploying Canvas API...${NC}"
kubectl apply -f "$K8S_DIR/canvas-api.yaml"
echo -e "${GREEN}✓ Canvas API deployed${NC}"
echo ""

# Wait for Canvas API to be ready
echo -e "${YELLOW}Waiting for Canvas API to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=canvas-api --timeout=120s
echo -e "${GREEN}✓ Canvas API is ready${NC}"
echo ""

# Deploy WebSocket Gateway
echo -e "${BLUE}Deploying WebSocket Gateway...${NC}"
kubectl apply -f "$K8S_DIR/websocket-gateway.yaml"
echo -e "${GREEN}✓ WebSocket Gateway deployed${NC}"
echo ""

# Wait for WebSocket Gateway to be ready
echo -e "${YELLOW}Waiting for WebSocket Gateway to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=websocket-gateway --timeout=120s
echo -e "${GREEN}✓ WebSocket Gateway is ready${NC}"
echo ""

# Deploy Frontend
echo -e "${BLUE}Deploying Frontend...${NC}"
kubectl apply -f "$K8S_DIR/frontend.yaml"
echo -e "${GREEN}✓ Frontend deployed${NC}"
echo ""

# Wait for Frontend to be ready
echo -e "${YELLOW}Waiting for Frontend to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=frontend --timeout=120s
echo -e "${GREEN}✓ Frontend is ready${NC}"
echo ""

# Deploy Ingress
echo -e "${BLUE}Deploying Ingress...${NC}"
kubectl apply -f "$K8S_DIR/ingress.yaml"
echo -e "${GREEN}✓ Ingress deployed${NC}"
echo ""

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "================================================"
echo "Deployment Status:"
echo "================================================"
kubectl get pods
echo ""
echo "Services:"
kubectl get services
echo ""
echo "================================================"
echo "Access Instructions:"
echo "================================================"
echo ""
echo "Option 1: Via NodePort (Direct Access)"
echo "  URL: http://localhost:30000"
echo ""
echo "Option 2: Via Port Forwarding"
echo "  Run: kubectl port-forward svc/frontend 8080:3000"
echo "  URL: http://localhost:8080"
echo ""
echo "To view logs:"
echo "  kubectl logs -f -l app=canvas-api"
echo "  kubectl logs -f -l app=websocket-gateway"
echo "  kubectl logs -f -l app=frontend"
echo ""
echo "To scale services:"
echo "  kubectl scale deployment canvas-api --replicas=3"
echo "  kubectl scale deployment websocket-gateway --replicas=3"
echo ""
