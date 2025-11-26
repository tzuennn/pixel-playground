const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const fetch = require("node-fetch");

const PORT = process.env.PORT || 3002;
const CANVAS_API_URL = process.env.CANVAS_API_URL || "http://localhost:3001";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track connected clients
let clients = new Set();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connections: clients.size,
    timestamp: new Date().toISOString(),
  });
});

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  console.log("New client connected. Total clients:", clients.size + 1);
  clients.add(ws);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      message: "Connected to Cloud Pixel Playground",
      clientId: generateClientId(),
    })
  );

  // Handle incoming messages
  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
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
    clients.delete(ws);
    console.log("Client disconnected. Total clients:", clients.size);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    clients.delete(ws);
  });
});

// Handle pixel update
async function handlePixelUpdate(data, senderWs) {
  try {
    const { x, y, color } = data;

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

    // Broadcast update to all connected clients
    broadcastToAll({
      type: "pixel_updated",
      x,
      y,
      color,
      timestamp: result.timestamp,
    });

    console.log(`Pixel updated: (${x}, ${y}) -> ${color}`);
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

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error("Error sending to client:", error);
      }
    }
  });

  console.log(`Broadcast to ${sentCount} clients`);
}

// Generate unique client ID
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Periodic connection status broadcast
setInterval(() => {
  if (clients.size > 0) {
    broadcastToAll({
      type: "stats",
      activeUsers: clients.size,
      timestamp: Date.now(),
    });
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
