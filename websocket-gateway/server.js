const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const fetch = require("node-fetch");

const PORT = process.env.PORT || 3002;
const CANVAS_API_URL = process.env.CANVAS_API_URL || "http://localhost:3001";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track connected clients with username
// Map: ws -> { username, clientId }
let clients = new Map();

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

  // Send initial stats
  broadcastStats();

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

    // Broadcast updated stats and user list
    broadcastStats();
    broadcastUserList();
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

      // Broadcast updated user list
      broadcastStats();
      broadcastUserList();
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

// Broadcast message to all connected clients
function broadcastToAll(message) {
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

  console.log(`Broadcast to ${sentCount} clients`);
}

// Broadcast stats (user count)
function broadcastStats() {
  broadcastToAll({
    type: "stats",
    activeUsers: clients.size,
    timestamp: Date.now(),
  });
}

// Broadcast active user list
function broadcastUserList() {
  const usernames = Array.from(clients.values())
    .map((info) => info.username || "Anonymous")
    .filter((name) => name !== "Anonymous"); // Only show named users

  broadcastToAll({
    type: "user_list",
    users: usernames,
    timestamp: Date.now(),
  });
}

// Generate unique client ID
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Periodic connection status broadcast
setInterval(() => {
  if (clients.size > 0) {
    broadcastStats();
    broadcastUserList();
  }
}, 30000); // Every 30 seconds

// Start server
server.listen(PORT, () => {
  console.log(`WebSocket Gateway running on port ${PORT}`);
  console.log(`Canvas API URL: ${CANVAS_API_URL}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");

  // Close all WebSocket connections
  clients.forEach((client) => {
    client.close(1000, "Server shutting down");
  });

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
