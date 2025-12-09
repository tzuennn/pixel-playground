# Cloud Pixel Playground - AI Agent Instructions

## Project Overview

Real-time collaborative 50×50 pixel canvas with microservices architecture on Kubernetes. Users draw pixels that broadcast instantly via WebSocket to all connected clients.

## Architecture (Critical to Understand)

### 3-Service Communication Pattern

```
Frontend (3000) → WebSocket Gateway (3002) → Canvas API (3001) → Redis (6379)
              ↖─────────────┘ (broadcasts)
```

**Key Flow:** User clicks pixel → WebSocket message → Gateway calls Canvas API → Redis stores → Gateway broadcasts to ALL clients

### Service Responsibilities

- **Frontend**: Vanilla JS/HTML5 Canvas with ES6 modules. Exposes `/config.js` endpoint to inject env vars (`WS_URL`, `API_URL`). Modular architecture: `config.js`, `canvasManager.js`, `apiService.js`, `websocketService.js`, `uiController.js`, `app.js`
- **WebSocket Gateway**: Stateless broadcaster. Tracks usernames per connection (Map<ws, {clientId, username, connectedAt}>). Forwards updates to Canvas API then broadcasts response with username
- **Canvas API**: Business logic + validation. Single source of truth via Redis (`canvas:pixels` hash with `x,y` keys)
- **Redis**: StatefulSet with PVC at `/data`. Canvas initialized to 2,500 white pixels (`#FFFFFF`) on first start

### Environment Variable Pattern

All services use `process.env.PORT || [default]`. Frontend injects URLs at runtime via `/config.js` for K8s service discovery:

- **K8s**: `WS_URL=ws://localhost:8080/ws`, `API_URL=http://localhost:8080/api` (via Ingress)
- **Local**: `WS_URL=ws://localhost:3002`, `API_URL=http://localhost:3001`
- **Internal K8s**: Canvas API uses `REDIS_HOST=redis-0.redis`, Gateway uses `CANVAS_API_URL=http://canvas-api:3001`

## Development Workflows

### Quick Start Commands

```bash
./scripts/dev-local.sh        # Local dev (fastest) - starts Redis Docker + 3 Node.js services
./scripts/build.sh            # Build all 3 Docker images
./scripts/deploy.sh           # Deploy to K8s (redis → canvas-api → websocket-gateway → frontend)
./scripts/stop-local.sh       # Stop local services
./scripts/cleanup.sh          # Delete K8s resources
```

**Access URLs:**

- Local dev: `http://localhost:3000`
- K8s NodePort: `http://localhost:30000`
- K8s Port-forward: `kubectl port-forward svc/frontend 8080:3000` → `http://localhost:8080`

### Debugging Failed Pods

```bash
kubectl logs -f deployment/[service-name]     # Stream logs
kubectl describe pod [pod-name]               # Check events for ImagePullBackOff/CrashLoopBackOff
kubectl exec -it redis-0 -- redis-cli HLEN canvas:pixels  # Verify 2500 pixels exist
kubectl exec -it redis-0 -- redis-cli HGET canvas:pixels "25,25"  # Check specific pixel
```

## Code Conventions

### Redis Key Pattern

- **Canvas state**: `canvas:pixels` hash with keys `"x,y"` (e.g., `"25,10"`) and hex color values
- **Initialization**: 50×50 grid = 2,500 entries, all `#FFFFFF` on first start
- Canvas API checks `exists(CANVAS_KEY)` and calls `initializeCanvas()` if missing

### WebSocket Message Types

```javascript
// Client → Gateway
{ type: "set_username", username: "Alice" }  // Set/change username (NEW)
{ type: "pixel_update", x: 10, y: 20, color: "#FF0000", username: "Alice" }  // Now includes username
{ type: "ping" }  // Health check

// Gateway → Clients
{ type: "pixel_updated", x: 10, y: 20, color: "#FF0000", username: "Alice", timestamp: 1234567890 }  // Now includes username
{ type: "user_list", users: ["Alice", "Bob"], timestamp: 1234567890 }  // Active usernames (NEW)
{ type: "connected", message: "...", clientId: "client_..." }
{ type: "stats", activeUsers: 5, timestamp: 1234567890 }  // Every 30s + immediate on connect/disconnect
{ type: "error", message: "Invalid pixel data" }
```

### Validation Rules (Canvas API)

- Coordinates: `0 ≤ x,y < 50` (50×50 canvas)
- Color format: `/^#[0-9A-F]{6}$/i` (hex only, uppercase or lowercase)
- Type checks: `typeof x === 'number'`, `typeof color === 'string'`
- Batch updates: Skip invalid pixels, process valid ones

### K8s Resource Naming

- Services: ClusterIP with app name (e.g., `canvas-api:3001`)
- Redis: StatefulSet with headless service → `redis-0.redis:6379` DNS name
- Images: Local builds use `[service]:latest` with `imagePullPolicy: IfNotPresent`
- Health probes: All services expose `/health` endpoint returning `{ status: "ok", ... }`

## Integration Points

### Frontend → Backend Communication

1. **Initial load**: `GET /api/canvas` returns all 2,500 pixels
2. **Real-time updates**: WebSocket connection at `WS_URL` (injected via `/config.js`)
3. **Optimistic UI**: Frontend updates canvas immediately on click, rollback if WebSocket error

### Cross-Service Dependencies

- WebSocket Gateway calls Canvas API via `fetch(CANVAS_API_URL + '/api/pixel', { method: 'PUT', ... })`
- Canvas API connects to Redis via `redis.createClient({ socket: { host: REDIS_HOST, ... } })`
- Frontend loads config from `/config.js` on page load (see `index.html` script tag)
- **Username System**: Frontend stores username in `localStorage` key `pixelPlaygroundUsername`, sends via `set_username` message on connect, Gateway tracks in Map (ws → {clientId, username, connectedAt})

### K8s Service Discovery

Services reference each other using K8s DNS names:

- `redis-0.redis` (StatefulSet headless service)
- `canvas-api:3001` (ClusterIP)
- `websocket-gateway:3002` (ClusterIP)

## Common Pitfalls

### Docker Image Issues

- **ImagePullBackOff**: Run `./scripts/build.sh` before `./scripts/deploy.sh`
- Local images require `imagePullPolicy: IfNotPresent` (not `Always`)

### Redis Connection Failures

- Canvas API has retry logic (10 attempts, 1s backoff)
- Check with `kubectl exec -it redis-0 -- redis-cli ping` → expect `PONG`
- PVC must exist: `kubectl get pvc redis-data-redis-0`

### WebSocket Not Broadcasting

- Gateway MUST call Canvas API first (stores in Redis), THEN broadcast
- Check `clients.size` in Gateway logs to verify connections
- Frontend expects `pixel_updated` type (not `pixel_update`)

### Port Conflicts in Local Dev

- Services hardcoded to 3000/3001/3002. Stop existing processes: `lsof -ti:3000 | xargs kill`
- Redis Docker container named `pixel-redis`. Remove with `docker rm -f pixel-redis`

## Prettier Formatting

Project uses Prettier for consistent formatting:

```bash
npm run format           # Format all files
npm run format:check     # CI check only
npm run format:[service] # Format specific service (canvas-api, websocket, frontend)
```

## Scaling Considerations

All services support horizontal scaling EXCEPT Redis (single StatefulSet):

```bash
kubectl scale deployment canvas-api --replicas=5
kubectl scale deployment websocket-gateway --replicas=3
kubectl scale deployment frontend --replicas=3
```

**WebSocket Gateway scaling**: Each pod maintains independent client connections. Clients connect to ONE gateway instance via K8s Service load balancing. All gateways call the same Canvas API, ensuring consistency.

## Key Files Reference

- `frontend/public/index.html`: HTML structure (~116 lines), includes Active Users Panel
- `frontend/public/css/styles.css`: All styles including username feature UI (user panels, drawing indicators, animations)
- `frontend/public/js/app.js`: Main application orchestration, integrates all modules
- `frontend/public/js/websocketService.js`: WebSocket connection management, sends username with pixel updates
- `frontend/public/js/uiController.js`: DOM manipulation, username prompt, active users display, drawing indicators with XSS protection
- `frontend/public/js/canvasManager.js`: Canvas rendering logic
- `frontend/public/js/apiService.js`: REST API communication
- `frontend/public/js/config.js`: Configuration loaded from `/config.js` endpoint
- `canvas-api/server.js`: Redis initialization at startup (`initRedis()` → `initializeCanvas()`)
- `websocket-gateway/server.js`: Uses Map for client tracking (ws → {clientId, username, connectedAt}), `handleSetUsername()` and `handlePixelUpdate()` functions
- `k8s/*.yaml`: Note `REDIS_HOST=redis-0.redis` env var format for StatefulSet DNS
- `scripts/dev-local.sh`: Shows correct startup order: Redis → Canvas API → WebSocket → Frontend
- `test-multiuser.js`: Multi-user testing with configurable users/pixels, validates broadcast success rate
- `docs/USERNAME_FEATURE.md`: Complete documentation of username and user presence feature
- `frontend/ARCHITECTURE.md`: Frontend modular architecture documentation
