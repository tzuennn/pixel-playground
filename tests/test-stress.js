/**
 * Stress Test with Connection Churn for Cloud Pixel Playground
 *
 * This script tests system scalability by:
 * 1. Creating high volume of concurrent connections
 * 2. Continuously connecting/disconnecting clients (churn)
 * 3. Maintaining steady drawing activity
 * 4. Measuring system performance under load
 */

const WebSocket = require("ws");
const { execSync } = require("child_process");

// Configuration
const WS_URL = process.env.WS_URL || "ws://localhost/ws";
const MAX_CLIENTS = parseInt(process.env.MAX_CLIENTS) || 100;
const STEADY_STATE_CLIENTS = parseInt(process.env.STEADY_STATE_CLIENTS) || 50;
const TEST_DURATION = parseInt(process.env.TEST_DURATION) || 60; // seconds
const CHURN_RATE = parseInt(process.env.CHURN_RATE) || 5; // clients/second
const PIXELS_PER_SECOND = parseInt(process.env.PIXELS_PER_SECOND) || 10;

// Stats tracking
const stats = {
  activeClients: [],
  totalConnectionsCreated: 0,
  totalConnectionsClosed: 0,
  pixelsSent: 0,
  pixelsReceived: 0,
  errors: 0,
  connectionErrors: 0,
  peakConnections: 0,
  latencies: [],
  messagesSentPerSecond: [],
  messagesReceivedPerSecond: [],
};

// Colors
const COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#FFC0CB",
  "#A52A2A",
  "#808080",
  "#000000",
];

let clientIdCounter = 0;
let testRunning = true;

/**
 * Create a WebSocket client
 */
function createClient() {
  return new Promise((resolve, reject) => {
    const clientId = ++clientIdCounter;
    const username = `Stress-${clientId}`;
    const ws = new WebSocket(WS_URL);
    let connected = false;

    const client = {
      id: clientId,
      ws,
      username,
      pixelsSent: 0,
      pixelsReceived: 0,
      connectedAt: Date.now(),
    };

    const timeout = setTimeout(() => {
      if (!connected) {
        stats.connectionErrors++;
        reject(new Error(`Connection timeout for client ${clientId}`));
      }
    }, 5000);

    ws.on("open", () => {
      connected = true;
      clearTimeout(timeout);

      ws.send(
        JSON.stringify({
          type: "set_username",
          username: username,
        })
      );

      stats.activeClients.push(client);
      stats.totalConnectionsCreated++;

      if (stats.activeClients.length > stats.peakConnections) {
        stats.peakConnections = stats.activeClients.length;
      }

      resolve(client);
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);

        if (message.type === "pixel_updated") {
          client.pixelsReceived++;
          stats.pixelsReceived++;

          // Track latency if timestamp is available
          if (message.timestamp) {
            const latency = Date.now() - message.timestamp;
            stats.latencies.push(latency);
          }
        }
      } catch (error) {
        stats.errors++;
      }
    });

    ws.on("error", (error) => {
      stats.errors++;
      if (!connected) {
        clearTimeout(timeout);
        stats.connectionErrors++;
        reject(error);
      }
    });

    ws.on("close", () => {
      const index = stats.activeClients.indexOf(client);
      if (index > -1) {
        stats.activeClients.splice(index, 1);
      }
      stats.totalConnectionsClosed++;
    });
  });
}

/**
 * Draw pixels for a client
 */
async function drawPixels(client, duration) {
  const color = COLORS[client.id % COLORS.length];
  const startTime = Date.now();

  while (Date.now() - startTime < duration * 1000 && testRunning) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const x = Math.floor(Math.random() * 50);
      const y = Math.floor(Math.random() * 50);

      try {
        client.ws.send(
          JSON.stringify({
            type: "pixel_update",
            x,
            y,
            color,
            username: client.username,
            timestamp: Date.now(),
          })
        );

        client.pixelsSent++;
        stats.pixelsSent++;
      } catch (error) {
        stats.errors++;
      }

      // Calculate delay to maintain target pixels per second
      const delayMs = 1000 / PIXELS_PER_SECOND;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } else {
      break;
    }
  }

  // Close connection
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.close();
  }
}

/**
 * Connection churn - continuously add/remove clients
 */
async function connectionChurn() {
  console.log(
    `\n🔄 Starting connection churn (${CHURN_RATE} clients/second)...\n`
  );

  while (testRunning) {
    // Add new clients if below steady state
    if (stats.activeClients.length < STEADY_STATE_CLIENTS) {
      try {
        const client = await createClient();

        // Each client draws for 5-15 seconds then disconnects
        const drawDuration = 5 + Math.random() * 10;
        drawPixels(client, drawDuration);
      } catch (error) {
        // Connection failed, continue
      }
    }

    // Wait before next connection attempt
    await new Promise((resolve) => setTimeout(resolve, 1000 / CHURN_RATE));
  }
}

/**
 * Monitor system metrics
 */
async function monitorMetrics() {
  console.log(`\n📊 Starting metrics monitoring...\n`);

  let lastPixelsSent = 0;
  let lastPixelsReceived = 0;

  while (testRunning) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pixelsSentThisSecond = stats.pixelsSent - lastPixelsSent;
    const pixelsReceivedThisSecond = stats.pixelsReceived - lastPixelsReceived;

    stats.messagesSentPerSecond.push(pixelsSentThisSecond);
    stats.messagesReceivedPerSecond.push(pixelsReceivedThisSecond);

    lastPixelsSent = stats.pixelsSent;
    lastPixelsReceived = stats.pixelsReceived;

    // Print live stats every 5 seconds
    if (stats.messagesSentPerSecond.length % 5 === 0) {
      console.log(
        `⏱️  [${stats.messagesSentPerSecond.length}s] Active: ${stats.activeClients.length} | Sent: ${pixelsSentThisSecond}/s | Received: ${pixelsReceivedThisSecond}/s | Errors: ${stats.errors}`
      );
    }
  }
}

/**
 * Get pod resource usage
 */
function getResourceUsage() {
  try {
    console.log("\n📊 Pod Resource Usage:\n");

    const podNames = execSync(
      'kubectl get pods -l app=websocket-gateway -o jsonpath="{.items[*].metadata.name}"',
      { encoding: "utf-8" }
    )
      .trim()
      .split(/\s+/)
      .filter((p) => p);

    for (const pod of podNames) {
      try {
        // Get CPU and memory usage
        const metricsOutput = execSync(`kubectl top pod ${pod} --no-headers`, {
          encoding: "utf-8",
        });

        console.log(`  • ${pod}:`);
        console.log(`    ${metricsOutput.trim()}`);

        // Get connection count
        const healthOutput = execSync(
          `kubectl exec ${pod} -- wget -qO- http://localhost:3002/health`,
          { encoding: "utf-8" }
        );

        const health = JSON.parse(healthOutput);
        console.log(`    Active connections: ${health.users.length}`);
      } catch (error) {
        console.log(`  • ${pod}: Metrics unavailable`);
      }
    }
  } catch (error) {
    console.error(
      "⚠️  Could not fetch resource usage (kubectl metrics may not be available)"
    );
  }
}

/**
 * Print final statistics
 */
function printStats() {
  console.log("\n" + "=".repeat(60));
  console.log("Stress Test Results");
  console.log("=".repeat(60));

  console.log(`\n🔌 Connection Statistics:`);
  console.log(`   Total connections created: ${stats.totalConnectionsCreated}`);
  console.log(`   Total connections closed: ${stats.totalConnectionsClosed}`);
  console.log(`   Peak concurrent connections: ${stats.peakConnections}`);
  console.log(`   Connection errors: ${stats.connectionErrors}`);

  const connectionSuccessRate = (
    (stats.totalConnectionsCreated /
      (stats.totalConnectionsCreated + stats.connectionErrors)) *
    100
  ).toFixed(1);
  console.log(`   Success rate: ${connectionSuccessRate}%`);

  console.log(`\n📊 Message Statistics:`);
  console.log(`   Pixels sent: ${stats.pixelsSent}`);
  console.log(`   Pixels received: ${stats.pixelsReceived}`);
  console.log(`   Errors: ${stats.errors}`);

  // Throughput
  const avgSentPerSecond =
    stats.messagesSentPerSecond.reduce((a, b) => a + b, 0) /
    stats.messagesSentPerSecond.length;
  const avgReceivedPerSecond =
    stats.messagesReceivedPerSecond.reduce((a, b) => a + b, 0) /
    stats.messagesReceivedPerSecond.length;
  const peakSentPerSecond = Math.max(...stats.messagesSentPerSecond);
  const peakReceivedPerSecond = Math.max(...stats.messagesReceivedPerSecond);

  console.log(`\n📈 Throughput:`);
  console.log(
    `   Average sent: ${avgSentPerSecond.toFixed(1)} messages/second`
  );
  console.log(`   Peak sent: ${peakSentPerSecond} messages/second`);
  console.log(
    `   Average received: ${avgReceivedPerSecond.toFixed(1)} messages/second`
  );
  console.log(`   Peak received: ${peakReceivedPerSecond} messages/second`);

  // Latency
  if (stats.latencies.length > 0) {
    stats.latencies.sort((a, b) => a - b);
    const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.5)];
    const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)];
    const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)];
    const avg =
      stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;

    console.log(`\n⏱️  Latency (message delivery time):`);
    console.log(`   Average: ${avg.toFixed(1)}ms`);
    console.log(`   p50: ${p50}ms`);
    console.log(`   p95: ${p95}ms`);
    console.log(`   p99: ${p99}ms`);

    if (p95 < 100) {
      console.log(`   ✓ Excellent latency`);
    } else if (p95 < 500) {
      console.log(`   ✓ Good latency`);
    } else {
      console.log(`   ⚠️  High latency - system may be overloaded`);
    }
  }

  // Broadcast effectiveness
  // Note: With connection churn, we can't accurately calculate expected broadcasts
  // because clients are constantly joining/leaving. We'd need to track exact client
  // count at each pixel send time. Instead, we use received/sent ratio as a health metric.
  const broadcastMultiplier = (stats.pixelsReceived / stats.pixelsSent).toFixed(
    1
  );

  console.log(`\n📡 Broadcast Effectiveness:`);
  console.log(`   Pixels sent: ${stats.pixelsSent}`);
  console.log(`   Pixels received (by all clients): ${stats.pixelsReceived}`);
  console.log(`   Broadcast multiplier: ${broadcastMultiplier}x`);
  console.log(`   Peak concurrent clients: ${stats.peakConnections}`);

  // With churn, a good multiplier is between (peak * 0.5) and peak
  // because average concurrent connections is typically 50-70% of peak
  const expectedMinMultiplier = stats.peakConnections * 0.5;
  const expectedMaxMultiplier = stats.peakConnections;

  if (
    broadcastMultiplier >= expectedMinMultiplier &&
    broadcastMultiplier <= expectedMaxMultiplier
  ) {
    console.log(
      `   ✓ Healthy (expected range: ${expectedMinMultiplier.toFixed(1)}x - ${expectedMaxMultiplier}x)`
    );
  } else if (broadcastMultiplier < expectedMinMultiplier) {
    console.log(
      `   ⚠️  Lower than expected (expected minimum: ${expectedMinMultiplier.toFixed(1)}x)`
    );
    console.log(`   This may indicate message loss or low client retention`);
  } else {
    console.log(
      `   ℹ️  Higher than expected - clients staying connected longer than average`
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("✓ Stress test completed!");
  console.log("=".repeat(60) + "\n");
}

/**
 * Main test execution
 */
async function runTest() {
  console.log(
    "🔥 Cloud Pixel Playground - Stress Test with Connection Churn\n"
  );
  console.log(`Configuration:`);
  console.log(`  • WebSocket URL: ${WS_URL}`);
  console.log(`  • Max clients: ${MAX_CLIENTS}`);
  console.log(`  • Steady state clients: ${STEADY_STATE_CLIENTS}`);
  console.log(`  • Test duration: ${TEST_DURATION}s`);
  console.log(`  • Churn rate: ${CHURN_RATE} connections/second`);
  console.log(
    `  • Target throughput: ${PIXELS_PER_SECOND} pixels/second per client`
  );
  console.log("");

  try {
    // Start monitoring
    monitorMetrics();

    // Start connection churn
    connectionChurn();

    // Get initial resource usage
    setTimeout(() => {
      getResourceUsage();
    }, 5000);

    // Run for test duration
    await new Promise((resolve) => setTimeout(resolve, TEST_DURATION * 1000));

    // Stop test
    testRunning = false;

    console.log("\n🛑 Stopping test...\n");

    // Close all active connections
    stats.activeClients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get final resource usage
    getResourceUsage();

    // Print results
    printStats();

    process.exit(0);
  } catch (error) {
    console.error("❌ Stress test failed:", error.message);
    process.exit(1);
  }
}

// Run the test
runTest();
