const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const WS_URL = process.env.WS_URL || "ws://localhost:3002";
const API_URL = process.env.API_URL || "http://localhost:3001";

const server = http.createServer((req, res) => {
  // Serve index.html
  if (req.url === "/" || req.url === "/index.html") {
    fs.readFile(
      path.join(__dirname, "public", "index.html"),
      (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end("Error loading page");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
      }
    );
  }
  // Serve config.js with environment variables
  else if (req.url === "/config.js") {
    const config = `
      window.APP_CONFIG = {
        WS_URL: '${WS_URL}',
        API_URL: '${API_URL}'
      };
    `;
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(config);
  }
  // Health check
  else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "ok", timestamp: new Date().toISOString() })
    );
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  console.log(`API URL: ${API_URL}`);
});
