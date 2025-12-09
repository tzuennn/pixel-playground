# Load Balancing Testing Guide

This guide demonstrates that the Cloud Pixel Playground properly load balances WebSocket connections across multiple pods using Redis Pub/Sub.

## Quick Test (Recommended)

Run the automated load balancing test:

```bash
# Install dependencies first
npm install

# Run with default settings (20 clients, 5 pixels each)
node test-load-balancing.js

# Or customize:
NUM_CLIENTS=50 PIXELS_PER_CLIENT=10 node test-load-balancing.js
```

**What to look for:**

- ✅ Connections distributed across multiple pods (check percentages)
- ✅ Broadcast effectiveness > 90% (Redis Pub/Sub working)
- ✅ User count aggregation > 90% (cross-pod stats working)

---

## Manual Testing

### 1. Verify Multiple Pods are Running

```bash
kubectl get pods -l app=websocket-gateway

# Expected output:
# NAME                                 READY   STATUS    RESTARTS   AGE
# websocket-gateway-5df98f5d75-abc12   1/1     Running   0          5m
# websocket-gateway-5df98f5d75-xyz34   1/1     Running   0          5m
```

### 2. Check Pod Health and Connections

```bash
# Check each pod's active connections
kubectl get pods -l app=websocket-gateway -o name | while read pod; do
  echo "=== $pod ==="
  kubectl exec $pod -- wget -qO- http://localhost:3002/health | jq .
  echo ""
done
```

**Example output:**

```json
{
  "status": "ok",
  "connections": 5,
  "users": ["Alice", "Bob", "Charlie"],
  "timestamp": "2025-11-26T22:30:00.000Z"
}
```

### 3. Monitor Pod Logs in Real-Time

Open multiple terminal windows:

**Terminal 1** - Pod A logs:

```bash
POD_A=$(kubectl get pods -l app=websocket-gateway -o name | head -1 | cut -d'/' -f2)
kubectl logs -f $POD_A
```

**Terminal 2** - Pod B logs:

```bash
POD_B=$(kubectl get pods -l app=websocket-gateway -o name | tail -1 | cut -d'/' -f2)
kubectl logs -f $POD_B
```

**Terminal 3** - Run multi-user test:

```bash
node test-multiuser.js
```

### 4. Observe Load Distribution

Watch the logs in Terminals 1 and 2. You should see:

**Pod A logs:**

```
New client connected. Total clients: 1
Client client_123_abc set username: LoadTest-1
Broadcast to 1 local clients
Published to Redis channel: pixel_updated
```

**Pod B logs:**

```
New client connected. Total clients: 1
Client client_456_xyz set username: LoadTest-2
Broadcast to 1 local clients
Published to Redis channel: pixel_updated
```

**Key indicators:**

- ✅ Different pods receive different client connections
- ✅ Both pods publish to Redis
- ✅ Both pods broadcast to their local clients
- ✅ Cross-pod updates work (client on Pod A sees updates from Pod B)

---

## Verifying Redis Pub/Sub

### 1. Monitor Redis Pub/Sub Activity

```bash
# Connect to Redis pod
kubectl exec -it redis-0 -- redis-cli

# In Redis CLI, monitor channels:
redis-0:6379> PUBSUB CHANNELS
1) "pixel-updates"
2) "user-events"

# See number of subscribers per channel
redis-0:6379> PUBSUB NUMSUB pixel-updates user-events
1) "pixel-updates"
2) "4"  # 2 pods × 2 connections each
3) "user-events"
4) "4"

# Monitor messages in real-time
redis-0:6379> SUBSCRIBE pixel-updates
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "pixel-updates"
3) (integer) 1
1) "message"
2) "pixel-updates"
3) "{\"type\":\"pixel_updated\",\"x\":25,\"y\":10,\"color\":\"#FF0000\",\"username\":\"Alice\",\"timestamp\":1234567890}"
```

### 2. Check Pod User Tracking in Redis

```bash
kubectl exec -it redis-0 -- redis-cli

# List all pod user keys
redis-0:6379> KEYS pod:*:users
1) "pod:nxzph29cr:users"
2) "pod:kvd298h5i:users"

# Get data from each pod
redis-0:6379> GET pod:nxzph29cr:users
"{\"count\":3,\"usernames\":[\"Alice\",\"Bob\",\"Charlie\"],\"timestamp\":1732659600000}"

redis-0:6379> GET pod:kvd298h5i:users
"{\"count\":2,\"usernames\":[\"David\",\"Eve\"],\"timestamp\":1732659601000}"

# Check TTL (should be ~60 seconds)
redis-0:6379> TTL pod:nxzph29cr:users
(integer) 45
```

---

## Stress Testing

### Scale Up WebSocket Gateway

```bash
# Scale to 5 replicas
kubectl scale deployment websocket-gateway --replicas=5

# Wait for pods to be ready
kubectl rollout status deployment/websocket-gateway

# Verify all pods running
kubectl get pods -l app=websocket-gateway
```

### Run Heavy Load Test

```bash
# 100 clients, 20 pixels each = 2000 total pixel updates
NUM_CLIENTS=100 PIXELS_PER_CLIENT=20 node test-load-balancing.js
```

**Expected results:**

- Connections distributed across all 5 pods (~20 each)
- Broadcast effectiveness > 85% (some message loss acceptable under load)
- No connection errors
- User count aggregation accurate

### Monitor Resource Usage

```bash
# Watch resource usage during test
kubectl top pods -l app=websocket-gateway --watch
```

**Expected:**

- CPU: 50-150m per pod
- Memory: 128-200Mi per pod
- All pods should show similar resource usage (balanced load)

---

## Verifying Load Balancing Algorithm

Kubernetes Service load balances using **random selection** by default. To verify:

```bash
# Describe the service
kubectl describe svc websocket-gateway

# Check endpoints (should list all pod IPs)
kubectl get endpoints websocket-gateway
```

**Example output:**

```
NAME                ENDPOINTS                           AGE
websocket-gateway   10.42.0.5:3002,10.42.0.6:3002      10m
```

### Test Connection Distribution

```bash
# Run test multiple times and check distribution
for i in {1..5}; do
  echo "=== Test $i ==="
  NUM_CLIENTS=10 node test-load-balancing.js | grep "connections"
  sleep 2
done
```

**Expected:** Different distributions each time (proving random load balancing).

---

## Troubleshooting

### Issue: All connections go to one pod

**Check:**

```bash
# Verify service endpoints
kubectl get endpoints websocket-gateway

# Check if all pods are ready
kubectl get pods -l app=websocket-gateway
```

**Fix:**

```bash
# Restart pods
kubectl rollout restart deployment/websocket-gateway
```

### Issue: Broadcast effectiveness < 70%

**Check Redis connection:**

```bash
# Check WebSocket Gateway logs
kubectl logs -l app=websocket-gateway --tail=50 | grep Redis

# Should see:
# ✓ Connected to Redis at redis-0.redis:6379
# ✓ Subscribed to channels: pixel-updates, user-events
```

**Check Redis health:**

```bash
kubectl exec -it redis-0 -- redis-cli ping
# Should return: PONG
```

### Issue: User count aggregation inaccurate

**Check pod keys in Redis:**

```bash
kubectl exec -it redis-0 -- redis-cli KEYS "pod:*:users"
```

If stale keys exist (from crashed pods), they'll expire after 60 seconds. Or manually delete:

```bash
kubectl exec -it redis-0 -- redis-cli DEL pod:old-pod-id:users
```

---

## Success Metrics

| Metric                           | Target | Meaning                         |
| -------------------------------- | ------ | ------------------------------- |
| Connection distribution variance | < 30%  | Load is evenly distributed      |
| Broadcast effectiveness          | > 90%  | Redis Pub/Sub working perfectly |
| User count aggregation accuracy  | > 95%  | Cross-pod stats working         |
| Message latency                  | < 50ms | Real-time performance           |
| Error rate                       | < 1%   | System stability                |

---

## Visualization

For visual confirmation:

1. **Open browser DevTools** (F12)
2. **Network tab** → Filter by "WS" (WebSocket)
3. **Messages tab** → Watch pixel_updated messages
4. **Console** → You'll see: `WebSocket connected to ws://localhost/ws`

The WebSocket URL doesn't show which pod you're connected to (that's intentional - clients shouldn't care). But you can correlate timestamps in browser console with pod logs to identify your connection.

---

## Continuous Monitoring

For production environments:

```bash
# Watch pod distribution every 10 seconds
watch -n 10 'kubectl get pods -l app=websocket-gateway -o name | xargs -I {} sh -c "echo === {} === && kubectl exec {} -- wget -qO- http://localhost:3002/health 2>/dev/null | jq -r \".connections,.users\""'
```

This gives you a real-time dashboard of connections per pod.
