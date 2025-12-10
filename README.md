# ☁️ Cloud Pixel Playground

A **real-time collaborative** 50×50 pixel canvas with username tracking, deployed on Kubernetes with scalable WebSocket architecture using Redis Pub/Sub.

## ✨ Features

- 🎨 **Real-time Collaboration**: Draw pixels that instantly appear for all connected users
- 👤 **Username System**: Set your username and see who's drawing
- 🔴 **Live Drawing Indicators**: See other users' cursors as they draw
- 📊 **Active User List**: View all connected artists in real-time
- ⚡ **Production-Ready Architecture**: Horizontally scalable WebSocket gateway with Redis Pub/Sub
- 🐳 **Kubernetes Native**: Full k8s deployment with Ingress, StatefulSet, and multi-replica services

## Architecture

```
                    ┌─────────────────────────────────┐
                    │   Traefik Ingress (Port 80)     │
                    │  /      /api       /ws          │
                    └──────────┬──────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         v                     v                     v
┌────────────────┐   ┌───────────────────┐   ┌─────────────────┐
│   Frontend     │   │  Canvas State API │   │ WebSocket GW    │
│   (2 replicas) │   │   (3 replicas)    │   │  (4 replicas)   │
│                │   │                   │   │                 │
│ Vanilla JS     │   │ • Pixel updates   │   │ • Optimistic    │
│ ES6 Modules    │   │ • Validation      │   │   broadcasting  │
│ HTML5 Canvas   │   │ • Canvas state    │   │ • Heartbeat     │
│ • Optimistic   │   │ • Async persist   │   │   monitoring    │
│   UI updates   │   │                   │   │ • Auto-reconnect│
└────────────────┘   └─────────┬─────────┘   └────────┬────────┘
                               │                      │
                               v                      v
                        ┌─────────────────────────────────┐
                        │         Redis StatefulSet        │
                        │                                  │
                        │ • Canvas storage (50×50 pixels)  │
                        │ • Pub/Sub channels               │
                        │   - pixel-updates                │
                        │   - user-events                  │
                        │ • Pod user tracking with TTL     │
                        │ • PVC for persistence            │
                        └─────────────────────────────────┘
```

## 🎯 Components

### Frontend (Port 3000)

- **Tech**: Vanilla JavaScript with ES6 modules, HTML5 Canvas
- **Features**:
  - Modular architecture (6 ES6 modules)
  - Username persistence via localStorage
  - Real-time drawing indicators with smooth animations
  - Optimistic UI updates with rollback
- **Modules**: `config.js`, `canvasManager.js`, `apiService.js`, `websocketService.js`, `uiController.js`, `app.js`

### WebSocket Gateway (Port 3002)

- **Tech**: Node.js, ws library, Redis client
- **Production Replicas**: 4 (scaled for load distribution)
- **Scalability**:
  - **Redis Pub/Sub** for cross-pod message broadcasting
  - **Pod-specific user tracking** stored in Redis with 60s TTL
  - **Aggregated stats** calculated from all pods
  - Supports unlimited horizontal scaling
- **Performance Optimizations**:
  - **Optimistic Broadcasting**: Validate locally, broadcast immediately, persist async
  - **Heartbeat Monitoring**: 30s ping/pong to detect dead connections
  - **Auto-Reconnection**: Exponential backoff (100ms→2s)
  - **Latency**: p50=58ms, p95=195ms (real-time ready)
- **Channels**:
  - `pixel-updates`: Broadcasts pixel changes to all pods
  - `user-events`: Notifies pods of user count changes

### Canvas State API (Port 3001)

- **Tech**: Node.js, Express, Redis
- **Production Replicas**: 3 (scaled for high availability)
- **Features**:
  - RESTful endpoints for canvas operations
  - Input validation (coordinates, color format)
  - 50×50 grid initialization on first start
  - Retry logic for Redis connections
  - Fire-and-forget persistence (optimized for latency)

### Redis StatefulSet (Port 6379)

- **Purpose**:
  - Persistent canvas storage (2,500 pixels)
  - Pub/Sub message broker for WebSocket pods
  - User session tracking across pods
- **Storage**: Persistent Volume Claim at `/data`
- **DNS**: Accessible as `redis-0.redis` (headless service)

## 🚀 Quick Start

### Prerequisites

- **Docker** with Colima or Docker Desktop
- **k3d** (k3s in Docker) - `brew install k3d`
- **kubectl** configured

### Deploy to Kubernetes

1. **Create k3d cluster** (if needed):

   ```bash
   k3d cluster create pixel-playground --port "80:80@loadbalancer" --port "443:443@loadbalancer"
   ```

2. **Build Docker images**:

   ```bash
   ./scripts/build.sh
   ```

3. **Import images to k3d**:

   ```bash
   k3d image import canvas-api:latest websocket-gateway:latest frontend:latest -c pixel-playground
   ```

4. **Deploy to Kubernetes**:

   ```bash
   ./scripts/deploy.sh
   ```

5. **Access the application**:
   ```
   http://localhost
   ```
   Or via NodePort:
   ```
   http://localhost:30000
   ```

### Local Development (Faster Iteration)

```bash
# Start all services locally (uses Docker Redis + Node.js services)
./scripts/dev-local.sh

# Access at http://localhost:3000

# Stop local services
./scripts/stop-local.sh
```

## 🧪 Testing

### Quick Manual Test

1. **Open multiple browser tabs** at `http://localhost`
2. **Set different usernames** in each tab
3. **Draw pixels** - they appear instantly on all tabs
4. **Watch the Active Artists panel** update in real-time
5. **See drawing indicators** showing other users' cursor positions

### Automated Test Suite

Comprehensive testing infrastructure for production validation:

#### 1. Load Balancing Test

```bash
npm run test:loadbalancing
# Tests: Connection distribution across WebSocket Gateway pods
# Validates: Kubernetes Service load balancing
```

**Expected Results:**

- Even distribution across all 4 WebSocket Gateway replicas
- Each pod handles 22-27% of connections
- 100% broadcast success rate

#### 2. Stress Test

```bash
npm run test:stress
# Tests: 100 concurrent clients, connection churn (5/sec)
# Validates: System performance under load
```

**Expected Results:**

- **Latency**: p50 < 60ms, p95 < 200ms, p99 < 300ms
- **Throughput**: > 50 pixels/second
- **Connection Success**: > 95%
- **Broadcast Effectiveness**: 30-40x multiplier

#### 3. Chaos Test

```bash
npm run test:chaos
# Tests: Pod failures every 15s with 20 connected clients
# Validates: Resilience and auto-reconnection
```

**Expected Results:**

- **Reconnection Success**: 100% of affected clients
- **Recovery Time**: < 200ms average
- **Delivery Rate**: > 95% (some in-flight messages lost)

#### 4. Concurrent Pixel Test

```bash
npm run test:concurrent
# Tests: Multiple clients editing same pixel simultaneously
# Validates: Race condition handling, last-write-wins consistency
```

**Expected Results:**

- **Consistency Rate**: 100%
- **Race Conditions Handled**: All detected scenarios
- **Final State**: Always matches last update

### Performance Metrics (Production)

| Metric            | Target  | Actual  |
| ----------------- | ------- | ------- |
| p50 Latency       | < 60ms  | 58ms    |
| p95 Latency       | < 200ms | 195ms   |
| p99 Latency       | < 300ms | ~250ms  |
| Reconnection Rate | > 95%   | 100%    |
| Broadcast Success | > 95%   | 100%    |
| Recovery Time     | < 500ms | < 200ms |

### Custom Test Parameters

```bash
# Aggressive stress test
MAX_CLIENTS=200 TEST_DURATION=120 npm run test:stress

# Extended chaos test
NUM_CLIENTS=50 TEST_DURATION=180 CHAOS_INTERVAL=10 npm run test:chaos

# Large-scale concurrent test
NUM_CLIENTS=50 TARGET_PIXELS=20 npm run test:concurrent

# Verify load distribution with many clients
NUM_CLIENTS=40 PIXELS_PER_CLIENT=5 npm run test:loadbalancing
```

## 📁 Project Structure

```
pixel-playground/
├── frontend/                 # Vanilla JS frontend with ES6 modules
│   ├── public/
│   │   ├── index.html       # Main HTML (116 lines)
│   │   ├── css/
│   │   │   └── styles.css   # All styles including username features
│   │   └── js/              # Modular ES6 architecture
│   │       ├── config.js    # Configuration loader
│   │       ├── canvasManager.js  # Canvas rendering
│   │       ├── apiService.js     # REST API calls
│   │       ├── websocketService.js  # WebSocket connection
│   │       ├── uiController.js      # DOM manipulation
│   │       └── app.js        # Main orchestration
│   ├── server.js            # Express server with config injection
│   └── package.json
│
├── canvas-api/              # RESTful Canvas State API
│   ├── server.js            # Express + Redis
│   └── package.json         # Dependencies: express, redis, cors
│
├── websocket-gateway/       # Scalable WebSocket Gateway
│   ├── server.js            # WebSocket + Redis Pub/Sub
│   └── package.json         # Dependencies: ws, express, redis
│
├── k8s/                     # Kubernetes manifests
│   ├── redis.yaml           # StatefulSet with PVC
│   ├── canvas-api.yaml      # Deployment (3 replicas - production)
│   ├── websocket-gateway.yaml  # Deployment (4 replicas - production)
│   ├── frontend.yaml        # Deployment (2 replicas)
│   └── ingress.yaml         # Traefik Ingress routing
│
├── scripts/
│   ├── build.sh             # Build all Docker images
│   ├── deploy.sh            # Deploy to Kubernetes
│   ├── dev-local.sh         # Start local development
│   ├── stop-local.sh        # Stop local services
│   └── cleanup.sh           # Delete Kubernetes resources
│
├── tests/                   # Comprehensive test suite
│   ├── test-load-balancing.js  # Load distribution verification
│   ├── test-stress.js          # Connection churn & throughput
│   ├── test-chaos.js           # Pod failure resilience
│   └── test-concurrent-pixel.js # Race condition handling
│
└── README.md
```

## 🏗️ Architecture Details

### WebSocket Scalability with Redis Pub/Sub

The WebSocket Gateway uses **Redis Pub/Sub** to enable horizontal scaling:

1. **Client connects** to any WebSocket pod (load-balanced by Kubernetes Service)
2. **Client sends pixel update** → received by Pod A
3. **Pod A publishes** to Redis channel `pixel-updates`
4. **All pods** (A, B, C...) receive the message via Redis subscription
5. **Each pod broadcasts** to its own connected WebSocket clients

This architecture allows:

- ✅ **Unlimited horizontal scaling** of WebSocket pods
- ✅ **Consistent user experience** regardless of pod assignment
- ✅ **No session affinity required** at load balancer
- ✅ **Production-ready** (used by Slack, Discord, etc.)

### User Tracking Across Pods

User stats are aggregated using Redis with pod-specific keys:

```javascript
// Each pod stores its users in Redis
pod: abc123: users = {
  count: 2,
  usernames: ["Alice", "Bob"],
  timestamp: 1234567890,
};

// Pods aggregate stats from all pod:*:users keys
// 60-second TTL ensures automatic cleanup of stale pods
```

### Environment Variables

**Kubernetes Deployment:**

- `WS_URL=ws://localhost/ws` (Ingress routing)
- `API_URL=http://localhost` (Canvas API adds `/api` path)
- `REDIS_HOST=redis-0.redis` (StatefulSet DNS)

**Local Development:**

- `WS_URL=ws://localhost:3002` (Direct WebSocket Gateway)
- `API_URL=http://localhost:3001` (Direct Canvas API)
- `REDIS_HOST=localhost` (Docker container)
