const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const WS_URL = process.env.WS_URL || "ws://localhost:3002";
const API_URL = process.env.API_URL || "http://localhost:3001";

// MIME types for different file extensions
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  // Serve index.html for root path
  if (req.url === "/") {
    req.url = "/index.html";
  }

  // Serve config.js with environment variables
  if (req.url === "/config.js") {
    const config = `
      window.APP_CONFIG = {
        WS_URL: '${WS_URL}',
        API_URL: '${API_URL}'
      };
    `;
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(config);
    return;
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "ok", timestamp: new Date().toISOString() })
    );
    return;
  }

  // Serve static files
  const filePath = path.join(__dirname, "public", req.url);
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not found");
      } else {
        res.writeHead(500);
        res.end(`Server error: ${err.code}`);
      }
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  console.log(`API URL: ${API_URL}`);
});
