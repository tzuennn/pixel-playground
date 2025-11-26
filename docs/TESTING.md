# Testing Guide

## Testing Strategy

This guide covers testing at multiple levels:

1. Component Testing (Individual services)
2. Integration Testing (Service interactions)
3. End-to-End Testing (Full user flow)
4. Kubernetes Testing (Deployment verification)

## Component Testing

### Canvas API Testing

#### Test 1: Health Check

```bash
# Start service locally
cd canvas-api
npm install
PORT=3001 REDIS_HOST=localhost REDIS_PORT=6379 npm start

# In another terminal, test health
curl http://localhost:3001/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "redis": "connected",
  "timestamp": "2025-11-13T..."
}
```

#### Test 2: Get Canvas

```bash
curl http://localhost:3001/api/canvas
```

**Expected Response:**

```json
{
  "width": 50,
  "height": 50,
  "pixels": {
    "0,0": "#FFFFFF",
    "0,1": "#FFFFFF",
    ...
  }
}
```

#### Test 3: Update Pixel

```bash
curl -X PUT http://localhost:3001/api/pixel \
  -H "Content-Type: application/json" \
  -d '{"x": 5, "y": 5, "color": "#FF0000"}'
```

**Expected Response:**

```json
{
  "success": true,
  "x": 5,
  "y": 5,
  "color": "#FF0000",
  "timestamp": 1699900000000
}
```

#### Test 4: Invalid Pixel

```bash
curl -X PUT http://localhost:3001/api/pixel \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 100, "color": "#FF0000"}'
```

**Expected Response:**

```json
{
  "error": "Coordinates out of bounds"
}
```

#### Test 5: Reset Canvas

```bash
curl -X POST http://localhost:3001/api/canvas/reset
```

### WebSocket Gateway Testing

#### Test 1: WebSocket Connection

```bash
# Install wscat if not already
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3002
```

**Expected:**

```json
< {"type":"connected","message":"Connected to Cloud Pixel Playground","clientId":"client_..."}
```

#### Test 2: Send Pixel Update

```bash
# After connecting with wscat
> {"type":"pixel_update","x":10,"y":10,"color":"#0000FF"}
```

**Expected:**

```json
< {"type":"pixel_updated","x":10,"y":10,"color":"#0000FF","timestamp":...}
```

#### Test 3: Multiple Connections

```bash
# Terminal 1
wscat -c ws://localhost:3002

# Terminal 2
wscat -c ws://localhost:3002

# Send update from Terminal 1
> {"type":"pixel_update","x":15,"y":15,"color":"#00FF00"}

# Both terminals should receive the update
```

### Frontend Testing

#### Test 1: Frontend Loads

```bash
cd frontend
npm install
PORT=3000 WS_URL=ws://localhost:3002 API_URL=http://localhost:3001 npm start

# Open browser
open http://localhost:3000
```

**Verify:**

- [ ] Page loads without errors
- [ ] Canvas displays 50×50 grid
- [ ] Status shows "Connected"
- [ ] Color picker works
- [ ] Preset colors clickable

#### Test 2: Drawing Works

1. Click on a pixel
2. Verify pixel color changes immediately
3. Open browser console - no errors

#### Test 3: Multi-User Collaboration

1. Open http://localhost:3000 in two browser windows
2. Draw in one window
3. Verify the other window updates automatically

## Integration Testing

### Test Full Stack Locally

```bash
# Start all services
./scripts/dev-local.sh

# Wait for all services to start (about 10 seconds)

# Run integration tests
curl http://localhost:3001/health  # Canvas API
curl http://localhost:3002/health  # WebSocket Gateway
curl http://localhost:3000/health  # Frontend

# Test pixel flow
curl -X PUT http://localhost:3001/api/pixel \
  -H "Content-Type: application/json" \
  -d '{"x": 25, "y": 25, "color": "#FFFF00"}'

# Verify pixel persists
curl http://localhost:3001/api/pixel/25/25
```

### Test WebSocket Flow

```bash
# Terminal 1: Start wscat
wscat -c ws://localhost:3002

# Terminal 2: Update via API
curl -X PUT http://localhost:3001/api/pixel \
  -H "Content-Type: application/json" \
  -d '{"x": 30, "y": 30, "color": "#FF00FF"}'

# Terminal 1 should receive the update (if gateway polls or events are set up)
```

## End-to-End Testing

### Manual E2E Test Checklist

Start the application and go through this checklist:

#### Initial Load

- [ ] Application loads at http://localhost:3000
- [ ] Status indicator shows green (connected)
- [ ] Canvas displays 50×50 grid
- [ ] All pixels are white initially (or last saved state)

#### Drawing

- [ ] Click on a pixel - it changes to selected color
- [ ] Click and drag - multiple pixels change
- [ ] Change color picker - new color applies
- [ ] Click preset colors - they apply immediately

#### Real-Time Collaboration

- [ ] Open second browser window
- [ ] Draw in first window
- [ ] Second window updates automatically
- [ ] Draw in second window
- [ ] First window updates automatically
- [ ] User count shows 2

#### Canvas Operations

- [ ] Click "Clear Canvas"
- [ ] Confirm dialog appears
- [ ] Canvas resets to white
- [ ] Change persists across refresh

#### Error Handling

- [ ] Stop WebSocket Gateway
- [ ] Status shows "Disconnected"
- [ ] Error message appears
- [ ] Restart Gateway
- [ ] Automatically reconnects

#### Persistence

- [ ] Draw some pixels
- [ ] Stop all services
- [ ] Start all services again
- [ ] Canvas shows previous drawings

## Kubernetes Testing

### Test Deployment

```bash
# Deploy to Kubernetes
./scripts/build.sh
./scripts/deploy.sh

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all --timeout=300s

# Check all pods are running
kubectl get pods
```

**Expected:**

```
NAME                                  READY   STATUS    RESTARTS   AGE
redis-0                               1/1     Running   0          2m
canvas-api-xxx-yyy                    1/1     Running   0          1m
canvas-api-xxx-zzz                    1/1     Running   0          1m
websocket-gateway-xxx-yyy             1/1     Running   0          1m
websocket-gateway-xxx-zzz             1/1     Running   0          1m
frontend-xxx-yyy                      1/1     Running   0          1m
frontend-xxx-zzz                      1/1     Running   0          1m
```

### Test Service Communication

```bash
# Test Redis
kubectl exec -it redis-0 -- redis-cli ping
# Expected: PONG

# Test Canvas API from inside cluster
kubectl run test-pod --rm -it --image=curlimages/curl -- sh
curl http://canvas-api:3001/health
# Expected: {"status":"ok",...}

# Test WebSocket Gateway
curl http://websocket-gateway:3002/health
# Expected: {"status":"ok",...}
```

### Test Persistence

```bash
# Update a pixel
kubectl port-forward svc/canvas-api 3001:3001 &
curl -X PUT http://localhost:3001/api/pixel \
  -H "Content-Type: application/json" \
  -d '{"x": 20, "y": 20, "color": "#00FFFF"}'

# Delete Redis pod
kubectl delete pod redis-0

# Wait for pod to restart
kubectl wait --for=condition=ready pod redis-0 --timeout=120s

# Check pixel is still there
curl http://localhost:3001/api/pixel/20/20
# Expected: {"x":20,"y":20,"color":"#00FFFF"}
```

### Test Scaling

```bash
# Scale WebSocket Gateway
kubectl scale deployment websocket-gateway --replicas=5

# Wait for new pods
kubectl wait --for=condition=ready pod -l app=websocket-gateway --timeout=120s

# Verify 5 replicas
kubectl get pods -l app=websocket-gateway
# Should show 5 pods

# Test load distribution (connect multiple clients)
```

### Test Fault Tolerance

```bash
# Delete a Canvas API pod
POD=$(kubectl get pod -l app=canvas-api -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod $POD

# Kubernetes should create a new pod immediately
kubectl get pods -l app=canvas-api --watch

# Application should still work
curl http://localhost:30000
```

### Test Rolling Update

```bash
# Update Canvas API image
kubectl set image deployment/canvas-api canvas-api=canvas-api:latest

# Watch rolling update
kubectl rollout status deployment/canvas-api

# Application should remain available throughout
# Test by continuously accessing: watch -n 1 curl http://localhost:30000/health
```

## Load Testing

### Simple Load Test

```bash
# Install Apache Bench
brew install httpd

# Test Canvas API
ab -n 1000 -c 10 http://localhost:3001/api/canvas

# Expected: < 100ms average response time
```

### WebSocket Load Test

```bash
# Create a simple load test script
cat > ws-load-test.js << 'EOF'
const WebSocket = require('ws');

const NUM_CLIENTS = 50;
let connectedClients = 0;

for (let i = 0; i < NUM_CLIENTS; i++) {
  const ws = new WebSocket('ws://localhost:3002');

  ws.on('open', () => {
    connectedClients++;
    console.log(`Connected: ${connectedClients}/${NUM_CLIENTS}`);

    // Send a pixel update every second
    setInterval(() => {
      const x = Math.floor(Math.random() * 50);
      const y = Math.floor(Math.random() * 50);
      const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

      ws.send(JSON.stringify({
        type: 'pixel_update',
        x, y, color
      }));
    }, 1000);
  });

  ws.on('message', (data) => {
    // Receiving updates
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

console.log(`Attempting to connect ${NUM_CLIENTS} clients...`);
EOF

# Run load test
node ws-load-test.js
```

## Automated Testing Script

```bash
# Create comprehensive test script
cat > test-all.sh << 'EOF'
#!/bin/bash
set -e

echo "🧪 Running Cloud Pixel Playground Tests"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
  local name=$1
  local url=$2
  local expected=$3

  echo -n "Testing $name... "
  response=$(curl -s "$url")

  if echo "$response" | grep -q "$expected"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Expected: $expected"
    echo "  Got: $response"
    ((FAILED++))
  fi
}

# Test Canvas API
test_endpoint "Canvas API Health" "http://localhost:3001/health" '"status":"ok"'
test_endpoint "Canvas API Get Canvas" "http://localhost:3001/api/canvas" '"width":50'
test_endpoint "Canvas API Get Pixel" "http://localhost:3001/api/pixel/0/0" '"color":'

# Test WebSocket Gateway
test_endpoint "WebSocket Gateway Health" "http://localhost:3002/health" '"status":"ok"'

# Test Frontend
test_endpoint "Frontend Health" "http://localhost:3000/health" '"status":"ok"'

echo ""
echo "================================"
echo "Test Results"
echo "================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "================================"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed${NC}"
  exit 1
fi
EOF

chmod +x test-all.sh
```

## Monitoring During Tests

```bash
# Watch pod status
watch kubectl get pods

# Monitor logs
kubectl logs -f deployment/canvas-api
kubectl logs -f deployment/websocket-gateway
kubectl logs -f deployment/frontend
kubectl logs -f statefulset/redis

# Monitor resource usage
watch kubectl top pods

# Monitor events
kubectl get events --sort-by=.metadata.creationTimestamp --watch
```

## Test Results Documentation

After running tests, document:

- ✅ All tests passed
- ⚠️ Tests with warnings
- ❌ Failed tests
- 📊 Performance metrics
- 🐛 Bugs found
- 💡 Improvements needed
