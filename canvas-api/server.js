const express = require("express");
const cors = require("cors");
const redis = require("redis");

const app = express();
const PORT = process.env.PORT || 3001;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Canvas configuration
const CANVAS_WIDTH = 50;
const CANVAS_HEIGHT = 50;
const CANVAS_KEY = "canvas:pixels";

// Middleware
app.use(cors());
app.use(express.json());

// Redis client
let redisClient;
let isRedisConnected = false;

// Initialize Redis connection
async function initRedis() {
  try {
    redisClient = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error("Too many Redis reconnection attempts");
            return new Error("Redis connection failed");
          }
          return retries * 1000;
        },
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
      isRedisConnected = false;
    });

    redisClient.on("connect", () => {
      console.log("Redis client connected");
      isRedisConnected = true;
    });

    await redisClient.connect();

    // Initialize canvas if it doesn't exist
    const exists = await redisClient.exists(CANVAS_KEY);
    if (!exists) {
      console.log("Initializing canvas...");
      await initializeCanvas();
    }

    console.log("Redis initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Redis:", error);
    isRedisConnected = false;
  }
}

// Initialize canvas with white pixels
async function initializeCanvas() {
  const initialCanvas = {};
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      initialCanvas[`${x},${y}`] = "#FFFFFF";
    }
  }
  await redisClient.hSet(CANVAS_KEY, initialCanvas);
  console.log(
    `Canvas initialized with ${CANVAS_WIDTH}x${CANVAS_HEIGHT} white pixels`
  );
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    redis: isRedisConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Get entire canvas
app.get("/api/canvas", async (req, res) => {
  try {
    if (!isRedisConnected) {
      return res.status(503).json({ error: "Redis not connected" });
    }

    const canvas = await redisClient.hGetAll(CANVAS_KEY);
    res.json({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      pixels: canvas,
    });
  } catch (error) {
    console.error("Error fetching canvas:", error);
    res.status(500).json({ error: "Failed to fetch canvas" });
  }
});

// Get specific pixel
app.get("/api/pixel/:x/:y", async (req, res) => {
  try {
    if (!isRedisConnected) {
      return res.status(503).json({ error: "Redis not connected" });
    }

    const { x, y } = req.params;
    const xNum = parseInt(x);
    const yNum = parseInt(y);

    if (xNum < 0 || xNum >= CANVAS_WIDTH || yNum < 0 || yNum >= CANVAS_HEIGHT) {
      return res.status(400).json({ error: "Coordinates out of bounds" });
    }

    const color = await redisClient.hGet(CANVAS_KEY, `${xNum},${yNum}`);
    res.json({ x: xNum, y: yNum, color: color || "#FFFFFF" });
  } catch (error) {
    console.error("Error fetching pixel:", error);
    res.status(500).json({ error: "Failed to fetch pixel" });
  }
});

// Update pixel
app.put("/api/pixel", async (req, res) => {
  try {
    if (!isRedisConnected) {
      return res.status(503).json({ error: "Redis not connected" });
    }

    const { x, y, color } = req.body;

    // Validation
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof color !== "string"
    ) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) {
      return res.status(400).json({ error: "Coordinates out of bounds" });
    }

    // Validate color format (hex color)
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      return res
        .status(400)
        .json({ error: "Invalid color format. Use hex format like #FF0000" });
    }

    // Update pixel in Redis
    await redisClient.hSet(CANVAS_KEY, `${x},${y}`, color);

    res.json({
      success: true,
      x,
      y,
      color,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error updating pixel:", error);
    res.status(500).json({ error: "Failed to update pixel" });
  }
});

// Update multiple pixels (batch update)
app.put("/api/pixels", async (req, res) => {
  try {
    if (!isRedisConnected) {
      return res.status(503).json({ error: "Redis not connected" });
    }

    const { pixels } = req.body;

    if (!Array.isArray(pixels)) {
      return res.status(400).json({ error: "Pixels must be an array" });
    }

    const updates = {};
    for (const pixel of pixels) {
      const { x, y, color } = pixel;

      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof color !== "string"
      ) {
        continue;
      }

      if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) {
        continue;
      }

      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        continue;
      }

      updates[`${x},${y}`] = color;
    }

    if (Object.keys(updates).length > 0) {
      await redisClient.hSet(CANVAS_KEY, updates);
    }

    res.json({
      success: true,
      updated: Object.keys(updates).length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error updating pixels:", error);
    res.status(500).json({ error: "Failed to update pixels" });
  }
});

// Reset canvas
app.post("/api/canvas/reset", async (req, res) => {
  try {
    if (!isRedisConnected) {
      return res.status(503).json({ error: "Redis not connected" });
    }

    await initializeCanvas();
    res.json({ success: true, message: "Canvas reset to white" });
  } catch (error) {
    console.error("Error resetting canvas:", error);
    res.status(500).json({ error: "Failed to reset canvas" });
  }
});

// Start server
async function start() {
  await initRedis();

  app.listen(PORT, () => {
    console.log(`Canvas API running on port ${PORT}`);
    console.log(`Canvas size: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
  });
}

start();
