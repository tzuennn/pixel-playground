# Deployment Guide

## Prerequisites

### Required Tools

- **Docker**: For building container images
- **Kubernetes**: k3s, minikube, or any Kubernetes cluster
- **kubectl**: Kubernetes command-line tool

### Installation

#### Docker

```bash
# macOS
brew install docker

# Or download Docker Desktop from docker.com
```

#### kubectl

```bash
# macOS
brew install kubectl

# Verify installation
kubectl version --client
```

#### k3s (Lightweight Kubernetes)

```bash
# macOS (using multipass)
brew install multipass
multipass launch --name k3s --cpus 2 --mem 4G
multipass exec k3s -- bash -c "curl -sfL https://get.k3s.io | sh -"
multipass exec k3s -- sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config

# Or use k3d (k3s in docker)
brew install k3d
k3d cluster create pixel-playground
```

#### Minikube (Alternative)

```bash
# macOS
brew install minikube

# Start cluster
minikube start --cpus 2 --memory 4096
```

## Deployment Options

### Option 1: Local Development (No Kubernetes)

Run all services locally for development and testing:

```bash
# Start all services
./scripts/dev-local.sh

# Access the application
open http://localhost:3000

# Stop all services
./scripts/stop-local.sh
```

**What this does:**

- Starts Redis in Docker
- Runs Canvas API on port 3001
- Runs WebSocket Gateway on port 3002
- Runs Frontend on port 3000
- All services communicate via localhost

### Option 2: Kubernetes Deployment

Full production-like deployment on Kubernetes:

```bash
# 1. Build Docker images
./scripts/build.sh

# 2. Deploy to Kubernetes
./scripts/deploy.sh

# 3. Access via NodePort
open http://localhost:30000

# Or use port forwarding
kubectl port-forward svc/frontend 8080:3000
open http://localhost:8080
```

## Step-by-Step Kubernetes Deployment

### Step 1: Verify Cluster

```bash
# Check cluster status
kubectl cluster-info

# Verify nodes
kubectl get nodes

# Should show at least one node in Ready state
```

### Step 2: Build Images

```bash
# Build all three images
cd /path/to/pixel-playground
./scripts/build.sh

# Verify images
docker images | grep -E "canvas-api|websocket-gateway|frontend"
```

**Expected Output:**

```
canvas-api            latest    abc123    2 minutes ago    200MB
websocket-gateway     latest    def456    1 minute ago     195MB
frontend              latest    ghi789    30 seconds ago   180MB
```

### Step 3: Deploy Services

```bash
# Deploy all services
./scripts/deploy.sh
```

This script deploys services in order:

1. **Redis** (StatefulSet with PVC)
2. **Canvas API** (Deployment)
3. **WebSocket Gateway** (Deployment)
4. **Frontend** (Deployment)
5. **Ingress** (Ingress resource)

### Step 4: Verify Deployment

```bash
# Check pods
kubectl get pods

# All pods should be Running
# Expected output:
# NAME                                  READY   STATUS    RESTARTS   AGE
# redis-0                               1/1     Running   0          2m
# canvas-api-xxxx-yyyy                  1/1     Running   0          1m
# canvas-api-xxxx-zzzz                  1/1     Running   0          1m
# websocket-gateway-xxxx-yyyy           1/1     Running   0          1m
# websocket-gateway-xxxx-zzzz           1/1     Running   0          1m
# frontend-xxxx-yyyy                    1/1     Running   0          1m
# frontend-xxxx-zzzz                    1/1     Running   0          1m

# Check services
kubectl get svc

# Check persistent volumes
kubectl get pvc
```

### Step 5: Access Application

#### Option A: NodePort (Simplest)

```bash
# Application is available at:
open http://localhost:30000
```

#### Option B: Port Forwarding

```bash
# Forward local port to frontend service
kubectl port-forward svc/frontend 8080:3000

# Access at:
open http://localhost:8080
```

#### Option C: Ingress (If NGINX Ingress Controller installed)

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Access at:
open http://localhost
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods

# Describe pod for details
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>
```

**Common Issues:**

- **ImagePullBackOff**: Images not built or not available
  - Solution: Run `./scripts/build.sh` again
- **CrashLoopBackOff**: Container starting then crashing
  - Solution: Check logs with `kubectl logs <pod-name>`
- **Pending**: Insufficient resources or PVC issues
  - Solution: Check with `kubectl describe pod <pod-name>`

### Service Not Accessible

```bash
# Check if services exist
kubectl get svc

# Check endpoints
kubectl get endpoints

# Test internal connectivity
kubectl run test-pod --rm -it --image=busybox -- sh
wget -O- http://canvas-api:3001/health
```

### Redis Connection Issues

```bash
# Check Redis pod
kubectl logs -f statefulset/redis

# Test Redis connection
kubectl exec -it redis-0 -- redis-cli ping
# Should return: PONG

# Check if data persists
kubectl exec -it redis-0 -- redis-cli HLEN canvas:pixels
# Should return: 2500 (50x50 pixels)
```

### WebSocket Issues

```bash
# Check WebSocket Gateway logs
kubectl logs -f deployment/websocket-gateway

# Test WebSocket endpoint
# Install wscat: npm install -g wscat
wscat -c ws://localhost:30002

# Or use port forwarding
kubectl port-forward svc/websocket-gateway 3002:3002
wscat -c ws://localhost:3002
```

## Scaling

### Scale Stateless Services

```bash
# Scale Canvas API
kubectl scale deployment canvas-api --replicas=5

# Scale WebSocket Gateway
kubectl scale deployment websocket-gateway --replicas=5

# Scale Frontend
kubectl scale deployment frontend --replicas=3

# Verify scaling
kubectl get pods -l app=canvas-api
```

### Monitor Resource Usage

```bash
# Install metrics server (if not already)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# View resource usage
kubectl top pods
kubectl top nodes
```

## Updating the Application

### Rolling Update

```bash
# 1. Make code changes

# 2. Rebuild image
cd canvas-api
docker build -t canvas-api:v2 .

# 3. Update deployment
kubectl set image deployment/canvas-api canvas-api=canvas-api:v2

# 4. Watch rollout
kubectl rollout status deployment/canvas-api

# 5. Verify
kubectl get pods
```

### Rollback

```bash
# View rollout history
kubectl rollout history deployment/canvas-api

# Rollback to previous version
kubectl rollout undo deployment/canvas-api

# Rollback to specific revision
kubectl rollout undo deployment/canvas-api --to-revision=2
```

## Cleanup

### Remove Application

```bash
# Delete all resources
./scripts/cleanup.sh

# Verify deletion
kubectl get pods
kubectl get pvc
```

### Remove Cluster (If using k3d/minikube)

```bash
# k3d
k3d cluster delete pixel-playground

# minikube
minikube delete
```

## Production Considerations

### High Availability

```bash
# Deploy Redis in HA mode (Redis Sentinel or Cluster)
# Multiple Redis replicas with automatic failover

# Increase service replicas
kubectl scale deployment canvas-api --replicas=5
kubectl scale deployment websocket-gateway --replicas=5
kubectl scale deployment frontend --replicas=3
```

### Monitoring

```bash
# Add Prometheus and Grafana
kubectl create namespace monitoring
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

### Logging

```bash
# View aggregated logs
kubectl logs -f -l app=canvas-api --tail=100
kubectl logs -f -l app=websocket-gateway --tail=100
kubectl logs -f -l app=frontend --tail=100

# Or use Stern for multi-pod log streaming
brew install stern
stern canvas-api
```

### Backup

```bash
# Backup Redis data
kubectl exec redis-0 -- redis-cli BGSAVE

# Copy data from pod
kubectl cp redis-0:/data/dump.rdb ./backup/dump.rdb

# Restore
kubectl cp ./backup/dump.rdb redis-0:/data/dump.rdb
kubectl exec redis-0 -- redis-cli SHUTDOWN SAVE
# Pod will restart and load from dump
```

## Environment Variables

### Frontend

- `PORT`: Server port (default: 3000)
- `WS_URL`: WebSocket Gateway URL
- `API_URL`: Canvas API URL

### Canvas API

- `PORT`: Server port (default: 3001)
- `REDIS_HOST`: Redis hostname
- `REDIS_PORT`: Redis port

### WebSocket Gateway

- `PORT`: Server port (default: 3002)
- `CANVAS_API_URL`: Canvas API URL

## Next Steps

After successful deployment:

1. Open the application in multiple browser windows
2. Start drawing and see real-time collaboration
3. Check Kubernetes dashboard for resource usage
4. Experiment with scaling services
5. Try rolling updates
6. Test fault tolerance by deleting pods
