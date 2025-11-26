const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const fetch = require("node-fetch");
const redis = require("redis");

const PORT = process.env.PORT || 3002;
const CANVAS_API_URL = process.env.CANVAS_API_URL || "http://localhost:3001";
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const BROADCAST_CHANNEL = "pixel-updates";
const USER_EVENTS_CHANNEL = "user-events";
const POD_ID = `pod-${Math.random().toString(36).substr(2, 9)}`; // Unique pod identifier

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track connected clients with username
// Map: ws -> { username, clientId }
let clients = new Map();

// Redis clients for pub/sub
let redisPublisher;
let redisSubscriber;
let redisReady = false;

// Initialize Redis connections
async function initRedis() {
  try {
    // Publisher client
    redisPublisher = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
    });

    // Subscriber client (separate connection required for pub/sub)
    redisSubscriber = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
    });

    redisPublisher.on("error", (err) =>
      console.error("Redis Publisher Error:", err)
    );
    redisSubscriber.on("error", (err) =>
      console.error("Redis Subscriber Error:", err)
    );

    await redisPublisher.connect();
    await redisSubscriber.connect();

    // Subscribe to broadcast channel for pixel updates
    await redisSubscriber.subscribe(BROADCAST_CHANNEL, (message) => {
      try {
        const data = JSON.parse(message);
        // Broadcast to all clients connected to THIS pod
        broadcastToLocalClients(data);
      } catch (error) {
        console.error("Error processing Redis message:", error);
      }
    });

    // Subscribe to user events channel for cross-pod user tracking
    await redisSubscriber.subscribe(USER_EVENTS_CHANNEL, async (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "user_update") {
          // Another pod updated its user count, broadcast aggregated stats to local clients
          await broadcastAggregatedStats();
        }
      } catch (error) {
        console.error("Error processing user event:", error);
      }
    });

    redisReady = true;
    console.log(`✓ Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    console.log(`✓ Pod ID: ${POD_ID}`);
    console.log(
      `✓ Subscribed to channels: ${BROADCAST_CHANNEL}, ${USER_EVENTS_CHANNEL}`
    );
  } catch (error) {
    console.error("Failed to initialize Redis:", error);
    console.log("⚠ Running in single-instance mode without cross-pod sync");
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connections: clients.size,
    users: Array.from(clients.values()).map((c) => c.username || "Anonymous"),
    timestamp: new Date().toISOString(),
  });
});

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  const clientId = generateClientId();
  const clientInfo = {
    clientId,
    username: null,
    connectedAt: Date.now(),
  };

  clients.set(ws, clientInfo);
  console.log("New client connected. Total clients:", clients.size);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      message: "Connected to Cloud Pixel Playground",
      clientId: clientId,
    })
  );

  // Send initial stats (async but don't await - fire and forget)
  broadcastStats().catch((err) =>
    console.error("Error broadcasting initial stats:", err)
  );

  // Handle incoming messages
  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "set_username":
          handleSetUsername(data, ws);
          break;

        case "pixel_update":
          await handlePixelUpdate(data, ws);
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;

        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    const info = clients.get(ws);
    clients.delete(ws);
    console.log(
      `Client disconnected: ${info?.username || "Anonymous"}. Total clients: ${clients.size}`
    );

    // Broadcast updated stats and user list (async but don't await)
    broadcastStats().catch((err) =>
      console.error("Error broadcasting stats on disconnect:", err)
    );
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    clients.delete(ws);
  });
});

// Handle set username
function handleSetUsername(data, ws) {
  const { username } = data;

  if (username && typeof username === "string") {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      const sanitizedUsername = username.trim().substring(0, 20);
      clientInfo.username = sanitizedUsername;
      console.log(
        `Client ${clientInfo.clientId} set username: ${sanitizedUsername}`
      );

      // Broadcast updated user list (async but don't await)
      broadcastStats().catch((err) =>
        console.error("Error broadcasting stats after username set:", err)
      );
    }
  }
}

// Handle pixel update
async function handlePixelUpdate(data, senderWs) {
  try {
    const { x, y, color, username } = data;

    // Validate data
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof color !== "string"
    ) {
      senderWs.send(
        JSON.stringify({
          type: "error",
          message: "Invalid pixel data",
        })
      );
      return;
    }

    // Update pixel in Canvas API
    const response = await fetch(`${CANVAS_API_URL}/api/pixel`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ x, y, color }),
    });

    if (!response.ok) {
      const error = await response.json();
      senderWs.send(
        JSON.stringify({
          type: "error",
          message: error.error || "Failed to update pixel",
        })
      );
      return;
    }

    const result = await response.json();

    // Broadcast update to all connected clients with username
    broadcastToAll({
      type: "pixel_updated",
      x,
      y,
      color,
      username: username || clients.get(senderWs)?.username || "Anonymous",
      timestamp: result.timestamp,
    });

    const displayName =
      username || clients.get(senderWs)?.username || "Anonymous";
    console.log(`Pixel updated by ${displayName}: (${x}, ${y}) -> ${color}`);
  } catch (error) {
    console.error("Error handling pixel update:", error);
    senderWs.send(
      JSON.stringify({
        type: "error",
        message: "Failed to process pixel update",
      })
    );
  }
}

// Broadcast message to all connected clients across all pods via Redis
async function broadcastToAll(message) {
  if (redisReady) {
    try {
      // Publish to Redis - all pods will receive this
      await redisPublisher.publish(BROADCAST_CHANNEL, JSON.stringify(message));
      console.log(`Published to Redis channel: ${message.type}`);
    } catch (error) {
      console.error("Error publishing to Redis:", error);
      // Fallback to local broadcast
      broadcastToLocalClients(message);
    }
  } else {
    // Fallback if Redis not available
    broadcastToLocalClients(message);
  }
}

// Broadcast message only to clients connected to THIS pod
function broadcastToLocalClients(message) {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  clients.forEach((clientInfo, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error("Error sending to client:", error);
      }
    }
  });

  console.log(`Broadcast to ${sentCount} local clients`);
}

// Update this pod's user count in Redis and notify other pods
async function updatePodUserCount() {
  if (!redisReady) {
    return;
  }

  try {
    // Store this pod's user list in Redis with TTL
    const usernames = Array.from(clients.values())
      .map((info) => info.username || "Anonymous")
      .filter((name) => name !== "Anonymous");

    await redisPublisher.setEx(
      `pod:${POD_ID}:users`,
      60, // 60 second TTL
      JSON.stringify({
        count: clients.size,
        usernames: usernames,
        timestamp: Date.now(),
      })
    );

    // Notify other pods about the update
    await redisPublisher.publish(
      USER_EVENTS_CHANNEL,
      JSON.stringify({ type: "user_update", podId: POD_ID })
    );
  } catch (error) {
    console.error("Error updating pod user count:", error);
  }
}

// Get aggregated stats from all pods and broadcast to local clients
async function broadcastAggregatedStats() {
  if (!redisReady) {
    // Fallback to local stats if Redis not available
    broadcastToLocalClients({
      type: "stats",
      activeUsers: clients.size,
      timestamp: Date.now(),
    });
    return;
  }

  try {
    // Get all pod keys
    const keys = await redisPublisher.keys("pod:*:users");

    let totalUsers = 0;
    let allUsernames = [];

    // Aggregate data from all pods
    for (const key of keys) {
      const data = await redisPublisher.get(key);
      if (data) {
        const podData = JSON.parse(data);
        totalUsers += podData.count;
        allUsernames = allUsernames.concat(podData.usernames);
      }
    }

    // Broadcast aggregated stats to local clients
    broadcastToLocalClients({
      type: "stats",
      activeUsers: totalUsers,
      timestamp: Date.now(),
    });

    // Broadcast aggregated user list
    broadcastToLocalClients({
      type: "user_list",
      users: allUsernames,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error broadcasting aggregated stats:", error);
    // Fallback to local stats
    broadcastToLocalClients({
      type: "stats",
      activeUsers: clients.size,
      timestamp: Date.now(),
    });
  }
}

// Broadcast stats (wrapper that updates Redis and broadcasts aggregated data)
async function broadcastStats() {
  await updatePodUserCount();
  await broadcastAggregatedStats();
}

// Broadcast active user list (now included in broadcastStats via aggregation)
async function broadcastUserList() {
  await updatePodUserCount();
  await broadcastAggregatedStats();
}

// Generate unique client ID
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Periodic connection status broadcast and cleanup of stale pod data
setInterval(() => {
  if (clients.size > 0 || redisReady) {
    broadcastStats().catch((err) =>
      console.error("Error in periodic stats broadcast:", err)
    );
  }
}, 30000); // Every 30 seconds

// Start server
async function startServer() {
  // Initialize Redis first
  await initRedis();

  server.listen(PORT, () => {
    console.log(`WebSocket Gateway running on port ${PORT}`);
    console.log(`Canvas API URL: ${CANVAS_API_URL}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  });
}

startServer();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing server...");

  // Close all WebSocket connections
  clients.forEach((clientInfo, ws) => {
    ws.close(1000, "Server shutting down");
  });

  // Close Redis connections
  if (redisPublisher) await redisPublisher.quit();
  if (redisSubscriber) await redisSubscriber.quit();

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
