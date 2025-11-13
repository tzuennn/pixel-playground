# Architecture Documentation

## System Overview

Cloud Pixel Playground is a real-time collaborative canvas application demonstrating cloud-native microservices architecture on Kubernetes.

## Components

### 1. Frontend (Port 3000)
- **Technology**: Vanilla JavaScript, HTML5 Canvas
- **Purpose**: Interactive 50×50 pixel grid UI
- **Key Features**:
  - Real-time pixel drawing
  - Color picker with presets
  - WebSocket connection for live updates
  - Touch and mouse support
  - Optimistic UI updates

### 2. WebSocket Gateway (Port 3002)
- **Technology**: Node.js + ws library
- **Purpose**: Real-time broadcast service
- **Key Features**:
  - Maintains WebSocket connections
  - Broadcasts pixel updates to all clients
  - Connection tracking and statistics
  - Automatic reconnection handling
  - Health monitoring

### 3. Canvas State API (Port 3001)
- **Technology**: Node.js + Express + Redis client
- **Purpose**: RESTful API for canvas operations
- **Key Features**:
  - CRUD operations for pixels
  - Batch pixel updates
  - Canvas reset functionality
  - Input validation
  - Health checks

### 4. Redis Database (Port 6379)
- **Technology**: Redis 7 Alpine
- **Purpose**: Persistent storage
- **Key Features**:
  - In-memory data structure store
  - Persistence via AOF (Append Only File)
  - Fast read/write operations
  - Snapshot backups every 60 seconds

## Data Flow

### Pixel Update Flow
```
User Click → Frontend
           ↓
   WebSocket Message
           ↓
   WebSocket Gateway
           ↓
   Canvas State API
           ↓
      Redis Storage
           ↓
   Broadcast to All Clients
           ↓
   Update All User UIs
```

### Initial Canvas Load
```
Browser → Frontend
        ↓
   HTTP Request
        ↓
   Canvas State API
        ↓
   Redis (fetch all pixels)
        ↓
   Return JSON
        ↓
   Render Canvas
```

## Kubernetes Architecture

### Networking
- **Ingress**: Single entry point for external traffic
  - `/` → Frontend service
  - `/api` → Canvas API service
  - `/ws` → WebSocket Gateway service

- **ClusterIP Services**: Internal service discovery
  - `redis-0.redis`: Redis StatefulSet headless service
  - `canvas-api:3001`: Canvas API ClusterIP
  - `websocket-gateway:3002`: WebSocket Gateway ClusterIP
  - `frontend:3000`: Frontend ClusterIP

### Storage
- **PersistentVolumeClaim**: Redis data persistence
  - Storage Class: `local-path` (k3s default)
  - Size: 1Gi
  - Access Mode: ReadWriteOnce
  - Mount Path: `/data` in Redis pod

### Scalability
- **Stateless Services** (horizontally scalable):
  - Canvas API: 2 replicas (can scale to N)
  - WebSocket Gateway: 2 replicas (can scale to N)
  - Frontend: 2 replicas (can scale to N)

- **StatefulSet** (maintains identity):
  - Redis: 1 replica (single source of truth)

### Resource Management
Each service has defined resource limits:
- **Memory**: 64Mi-256Mi depending on service
- **CPU**: 50m-200m depending on service

### Health Checks
- **Liveness Probes**: Restart containers if unhealthy
- **Readiness Probes**: Remove from service load balancing if not ready

## Key Cloud Concepts Demonstrated

1. **Containerization**: Each service runs in isolated Docker containers
2. **Orchestration**: Kubernetes manages deployment, scaling, and healing
3. **Service Discovery**: Internal DNS for service-to-service communication
4. **Load Balancing**: Traffic distributed across pod replicas
5. **Persistent Storage**: Data survives pod restarts via PVC
6. **Ingress/Routing**: Single external endpoint routing to multiple services
7. **Health Monitoring**: Automated health checks and recovery
8. **Rolling Updates**: Zero-downtime deployments
9. **Horizontal Scaling**: Add/remove replicas based on load
10. **Fault Tolerance**: Automatic pod recreation on failure

## Microservices Benefits

- **Independent Deployment**: Each service can be updated separately
- **Technology Diversity**: Different services can use different tech stacks
- **Scalability**: Scale services independently based on load
- **Fault Isolation**: One service failure doesn't bring down entire system
- **Team Organization**: Different teams can own different services

## Communication Patterns

### Synchronous (HTTP/REST)
- Frontend → Canvas API (initial load)
- WebSocket Gateway → Canvas API (pixel updates)

### Asynchronous (WebSocket)
- Frontend ↔ WebSocket Gateway (real-time updates)

### Publish-Subscribe Pattern
- WebSocket Gateway acts as message broker
- All connected clients subscribe to pixel updates
- Any client can publish updates

## Security Considerations

### Current Implementation (Development)
- No authentication/authorization
- No rate limiting
- No input sanitization beyond basic validation

### Production Recommendations
- Add OAuth2/JWT authentication
- Implement rate limiting per user
- Add CORS restrictions
- Enable TLS/HTTPS
- Implement network policies
- Add secrets management for sensitive data
- Enable Redis authentication

## Monitoring and Observability

### Health Endpoints
- Frontend: `http://localhost:3000/health`
- Canvas API: `http://localhost:3001/health`
- WebSocket Gateway: `http://localhost:3002/health`

### Kubernetes Commands
```bash
# View pod status
kubectl get pods

# View logs
kubectl logs -f deployment/canvas-api
kubectl logs -f deployment/websocket-gateway
kubectl logs -f deployment/frontend
kubectl logs -f statefulset/redis

# View resource usage
kubectl top pods

# View events
kubectl get events --sort-by=.metadata.creationTimestamp
```

## Performance Characteristics

### Latency
- Pixel Update: < 100ms end-to-end
- Initial Canvas Load: < 500ms
- WebSocket Broadcast: < 50ms

### Capacity
- Concurrent Users: 100+ (limited by WebSocket Gateway)
- Canvas Size: 50×50 = 2,500 pixels
- Redis Memory: ~1MB for canvas data

### Bottlenecks
1. WebSocket Gateway: Connection limit per pod (~1000 connections)
2. Redis: Single instance (can be clustered for HA)
3. Network: Kubernetes CNI bandwidth

## Future Enhancements

1. **Authentication**: User login system
2. **Multi-Canvas**: Support multiple canvases
3. **History**: Undo/redo functionality
4. **Export**: Download canvas as image
5. **Rooms**: Separate collaborative spaces
6. **Rate Limiting**: Prevent abuse
7. **Monitoring**: Prometheus + Grafana
8. **Logging**: ELK stack integration
9. **Redis HA**: Redis Cluster or Sentinel
10. **CDN**: Static asset delivery
