# Cloud Pixel Playground

A real-time collaborative 50×50 pixel canvas deployed on Kubernetes.

## Architecture

```
                 ┌─────────────────────────┐
                 │         Ingress          │
                 │ (HTTP + WebSocket entry) │
                 └─────────────┬───────────┘
                               │
       ┌────────────────────────┼──────────────────────────┐
       │                        │                          │
       v                        v                          v

┌───────────────────┐   ┌──────────────────────┐    ┌─────────────────────┐
│    Frontend UI    │   │  WebSocket Gateway    │    │   Canvas State API  │
│ (interactive grid)│<->│ (real-time broadcast) │<-->|  (update + fetch)   │
└───────────────────┘   └──────────────────────┘    └────────────┬────────┘
                                                                  │
                                                                  v
                                                    ┌─────────────────────────┐
                                                    │   Persistent Database    │
                                                    │ (Redis via PVC)         │
                                                    └─────────────────────────┘
```

## Components

- **Frontend**: Interactive 50×50 grid UI
- **WebSocket Gateway**: Real-time broadcast service
- **Canvas State API**: RESTful API for canvas operations
- **Redis Database**: Persistent storage with StatefulSet

## Quick Start

1. **Prerequisites**:
   - Docker installed
   - Kubernetes cluster (k3s, minikube, or similar)
   - kubectl configured

2. **Build and Deploy**:

   ```bash
   # Build all services
   ./scripts/build.sh

   # Deploy to Kubernetes
   ./scripts/deploy.sh

   # Get the application URL
   kubectl get ingress
   ```

3. **Access**:
   - Open browser to ingress URL
   - Start drawing on the 50×50 grid
   - Open multiple browsers to see real-time collaboration

## Development

Each service is in its own directory:

- `frontend/` - React-based UI
- `websocket-gateway/` - Node.js WebSocket server
- `canvas-api/` - Node.js REST API
- `k8s/` - Kubernetes manifests

## Testing Each Component

```bash
# Test frontend locally
cd frontend && npm install && npm start

# Test canvas API locally
cd canvas-api && npm install && npm start

# Test WebSocket gateway locally
cd websocket-gateway && npm install && npm start
```
