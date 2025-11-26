# Redis Pub/Sub Architecture for Scalable WebSockets

## Problem Statement

When running multiple WebSocket Gateway pods in Kubernetes, each pod maintains its own list of connected clients. Without synchronization, clients connected to different pods cannot see each other's updates.

**Example Issue:**

- User A connects to Pod 1
- User B connects to Pod 2
- User A draws a pixel → only Pod 1's clients see it
- User B sees 1 user online (Pod 2 only knows about itself)

## Solution: Redis Pub/Sub

Redis Pub/Sub acts as a message broker, broadcasting messages to all WebSocket Gateway pods simultaneously.

### Architecture Flow

```
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│   Pod A     │        │   Pod B     │        │   Pod C     │
│             │        │             │        │             │
│ Clients:    │        │ Clients:    │        │ Clients:    │
│ - Alice     │        │ - Bob       │        │ - Charlie   │
│ - David     │        │ - Eve       │        │ - Frank     │
└──────┬──────┘        └──────┬──────┘        └──────┬──────┘
       │                      │                       │
       │ publish              │ subscribe             │ subscribe
       │                      │                       │
       └──────────────┬───────┴───────────────────────┘
                      │
              ┌───────▼────────┐
              │     Redis      │
              │   Pub/Sub      │
              │                │
              │ Channels:      │
              │ • pixel-updates│
              │ • user-events  │
              └────────────────┘
```

### Implementation

#### 1. Initialize Redis Clients

Each WebSocket Gateway pod creates two Redis connections:

```javascript
// Publisher - sends messages to channels
redisPublisher = redis.createClient({
  socket: { host: REDIS_HOST, port: REDIS_PORT },
});

// Subscriber - receives messages from channels (must be separate connection)
redisSubscriber = redis.createClient({
  socket: { host: REDIS_HOST, port: REDIS_PORT },
});

await redisPublisher.connect();
await redisSubscriber.connect();
```

#### 2. Subscribe to Channels

```javascript
// Subscribe to pixel updates
await redisSubscriber.subscribe("pixel-updates", (message) => {
  const data = JSON.parse(message);
  broadcastToLocalClients(data); // Send to this pod's WebSocket clients
});

// Subscribe to user events
await redisSubscriber.subscribe("user-events", async (message) => {
  const data = JSON.parse(message);
  if (data.type === "user_update") {
    await broadcastAggregatedStats(); // Recalculate total users
  }
});
```

#### 3. Publish Updates

When a client sends a pixel update:

```javascript
async function handlePixelUpdate(data, senderWs) {
  // 1. Update Canvas API (single source of truth)
  await fetch(`${CANVAS_API_URL}/api/pixel`, {
    method: "PUT",
    body: JSON.stringify({ x, y, color }),
  });

  // 2. Publish to Redis (all pods receive this)
  await redisPublisher.publish(
    "pixel-updates",
    JSON.stringify({
      type: "pixel_updated",
      x,
      y,
      color,
      username: data.username,
      timestamp: Date.now(),
    })
  );
}
```

#### 4. Aggregate User Stats Across Pods

Each pod stores its user list in Redis with a unique key:

```javascript
// Store this pod's users in Redis with 60-second TTL
await redisPublisher.setEx(
  `pod:${POD_ID}:users`,
  60, // Auto-expire after 60 seconds
  JSON.stringify({
    count: clients.size,
    usernames: ["Alice", "David"],
    timestamp: Date.now(),
  })
);

// Notify other pods
await redisPublisher.publish(
  "user-events",
  JSON.stringify({
    type: "user_update",
    podId: POD_ID,
  })
);
```

When notified, pods aggregate stats from all pods:

```javascript
async function broadcastAggregatedStats() {
  // Get all pod keys
  const keys = await redisPublisher.keys("pod:*:users");

  let totalUsers = 0;
  let allUsernames = [];

  // Sum data from all pods
  for (const key of keys) {
    const data = JSON.parse(await redisPublisher.get(key));
    totalUsers += data.count;
    allUsernames = allUsernames.concat(data.usernames);
  }

  // Broadcast aggregated stats to local clients
  broadcastToLocalClients({
    type: "stats",
    activeUsers: totalUsers, // Total across ALL pods
    timestamp: Date.now(),
  });

  broadcastToLocalClients({
    type: "user_list",
    users: allUsernames, // All usernames across ALL pods
    timestamp: Date.now(),
  });
}
```

## Message Types

### pixel-updates Channel

Broadcasts pixel changes to all pods.

```javascript
{
  type: 'pixel_updated',
  x: 25,
  y: 10,
  color: '#FF0000',
  username: 'Alice',
  timestamp: 1234567890
}
```

### user-events Channel

Notifies pods of user count changes.

```javascript
{
  type: 'user_update',
  podId: 'pod-abc123'
}
```

## Key Design Decisions

### 1. Separate Publisher and Subscriber Connections

Redis Pub/Sub requires a dedicated connection for subscribing. A subscribed connection cannot be used for other Redis commands.

### 2. Pod-Specific User Keys with TTL

- **Format**: `pod:{podId}:users`
- **TTL**: 60 seconds
- **Benefit**: Automatic cleanup when pods crash or scale down

### 3. Local Broadcasting After Redis

When a message is received from Redis, each pod broadcasts to its own WebSocket clients. This avoids loops (a pod publishing and re-receiving its own messages).

```javascript
// CORRECT: Publish once to Redis
await redisPublisher.publish("pixel-updates", message);

// Each pod receives from Redis and broadcasts locally
redisSubscriber.subscribe("pixel-updates", (message) => {
  broadcastToLocalClients(JSON.parse(message));
});
```

### 4. Aggregated Stats, Not Per-Pod Stats

Sending per-pod stats via Redis would cause race conditions. Instead:

- Each pod stores its stats in Redis
- Each pod reads ALL pod stats when needed
- Each pod sends aggregated total to its clients

## Scalability Characteristics

| Metric                 | Value                                    |
| ---------------------- | ---------------------------------------- |
| **Max WebSocket Pods** | Unlimited (tested with 10+)              |
| **Latency Overhead**   | ~1-2ms (Redis network hop)               |
| **Redis Load**         | 1 publish + N subscribes per message     |
| **Message Ordering**   | Guaranteed per channel                   |
| **Failure Mode**       | Redis down = fallback to local broadcast |

## Fallback Behavior

If Redis connection fails:

```javascript
if (redisReady) {
  await redisPublisher.publish("pixel-updates", message);
} else {
  // Fallback: broadcast to local clients only
  broadcastToLocalClients(message);
}
```

This ensures the application continues working (with reduced functionality) if Redis is unavailable.

## Production Considerations

### High Availability

- Deploy Redis as a StatefulSet with persistent volume
- Consider Redis Sentinel for automatic failover
- Or use managed Redis (AWS ElastiCache, Azure Cache, etc.)

### Monitoring

Monitor these metrics:

- `redis.clients.connected`: Number of connected clients
- `redis.pubsub.channels`: Active channel count
- `redis.pubsub.patterns`: Pattern subscriptions
- Pod user count discrepancies (should match actual connections)

### Security

- Use Redis AUTH password in production
- Enable TLS for Redis connections
- Network policies to restrict Redis access to WebSocket pods only

## Alternative Approaches

### 1. Sticky Sessions (Not Used)

**Pros**: Simple, no Redis needed
**Cons**:

- Poor load balancing
- Session loss on pod restart
- Can't share updates between users on different pods

### 2. Database Polling (Not Used)

**Pros**: No additional infrastructure
**Cons**:

- High latency (poll interval)
- Heavy database load
- Not real-time

### 3. Message Queue (Not Used)

**Pros**: Durable message delivery
**Cons**:

- Overkill for ephemeral messages
- Higher latency than Pub/Sub
- More complex setup

**Why Redis Pub/Sub?**

- ✅ Low latency (~1-2ms)
- ✅ Simple setup (already using Redis for canvas storage)
- ✅ Industry standard (Discord, Slack, etc.)
- ✅ Perfect for ephemeral real-time messages
