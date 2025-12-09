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
│   (2 replicas) │   │   (2 replicas)    │   │  (2+ replicas)  │
│                │   │                   │   │                 │
│ Vanilla JS     │   │ • Pixel updates   │   │ • Redis Pub/Sub │
│ ES6 Modules    │   │ • Validation      │   │ • Cross-pod     │
│ HTML5 Canvas   │   │ • Canvas state    │   │   broadcast     │
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
- **Scalability**:
  - **Redis Pub/Sub** for cross-pod message broadcasting
  - **Pod-specific user tracking** stored in Redis with 60s TTL
  - **Aggregated stats** calculated from all pods
  - Supports horizontal scaling (2+ replicas)
- **Channels**:
  - `pixel-updates`: Broadcasts pixel changes to all pods
  - `user-events`: Notifies pods of user count changes

### Canvas State API (Port 3001)

- **Tech**: Node.js, Express, Redis
- **Features**:
  - RESTful endpoints for canvas operations
  - Input validation (coordinates, color format)
  - 50×50 grid initialization on first start
  - Retry logic for Redis connections

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

## 🧪 Testing Multi-User Collaboration

1. **Open multiple browser tabs** at `http://localhost`
2. **Set different usernames** in each tab
3. **Draw pixels** - they appear instantly on all tabs
4. **Watch the Active Artists panel** update in real-time
5. **See drawing indicators** showing other users' cursor positions

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
│   ├── canvas-api.yaml      # Deployment (2 replicas)
│   ├── websocket-gateway.yaml  # Deployment (2 replicas)
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
├── tests/
│   └── test-load-balancing.js  # Load balancing verification
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
