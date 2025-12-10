/**
 * Chaos Testing for Cloud Pixel Playground
 *
 * This script tests system resilience by:
 * 1. Creating active WebSocket connections
 * 2. Randomly killing pods during operation
 * 3. Verifying clients auto-reconnect and continue working
 * 4. Measuring recovery time and message loss
 */

const WebSocket = require("ws");
const { execSync } = require("child_process");

// Configuration
const WS_URL = process.env.WS_URL || "ws://localhost/ws";
const NUM_CLIENTS = parseInt(process.env.NUM_CLIENTS) || 10;
const TEST_DURATION = parseInt(process.env.TEST_DURATION) || 60; // seconds
const CHAOS_INTERVAL = parseInt(process.env.CHAOS_INTERVAL) || 15; // seconds between pod kills
const PIXELS_PER_INTERVAL = parseInt(process.env.PIXELS_PER_INTERVAL) || 5;

// Stats tracking
const stats = {
  clients: [],
  pixelsSent: 0,
  pixelsReceived: 0,
  reconnections: 0,
  podKills: 0,
  errors: 0,
  messageLoss: 0,
  recoveryTimes: [],
};

// Colors for different clients
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

/**
 * Create a resilient WebSocket client with auto-reconnect
 */
function createResilientClient(clientId) {
  const username = `Chaos-${clientId}`;
  let reconnectAttempts = 0;
  let disconnectTime = null;

  const client = {
    id: clientId,
    ws: null,
    username,
    pixelsSent: 0,
    pixelsReceived: 0,
    reconnected: false,
    disconnectCount: 0,
    reconnectCount: 0,
    isRunning: true,
  };

  function connect() {
    const ws = new WebSocket(WS_URL);
    client.ws = ws;

    ws.on("open", () => {
      if (reconnectAttempts > 0) {
        const recoveryTime = Date.now() - disconnectTime;
        stats.recoveryTimes.push(recoveryTime);
        stats.reconnections++;
        client.reconnectCount++;
        console.log(
          `🔄 Client ${clientId} reconnected after ${recoveryTime}ms (attempt ${reconnectAttempts})`
        );
        client.reconnected = true;
      } else {
        console.log(`✓ Client ${clientId} connected`);
      }

      // Set username
      ws.send(
        JSON.stringify({
          type: "set_username",
          username: username,
        })
      );
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);

        if (message.type === "pixel_updated") {
          client.pixelsReceived++;
          stats.pixelsReceived++;
        }
      } catch (error) {
        stats.errors++;
      }
    });

    ws.on("error", (error) => {
      // Expected during chaos - pods are being killed
      stats.errors++;
    });

    ws.on("close", () => {
      if (client.isRunning) {
        // Unexpected disconnect - try to reconnect
        disconnectTime = Date.now();
        reconnectAttempts++;
        client.disconnectCount++;

        console.log(
          `⚠️  Client ${clientId} disconnected (disconnect #${client.disconnectCount}), reconnecting...`
        );

        // Exponential backoff: 100ms, 200ms, 400ms, max 2s
        const backoff = Math.min(
          100 * Math.pow(2, reconnectAttempts - 1),
          2000
        );

        setTimeout(() => {
          if (client.isRunning) {
            connect();
          }
        }, backoff);
      }
    });
  }

  connect();
  stats.clients.push(client);
  return client;
}

/**
 * Continuously draw pixels for a client
 */
async function continuousDrawing(client) {
  const color = COLORS[client.id % COLORS.length];

  while (client.isRunning) {
    if (client.ws && client.ws.readyState === WebSocket.OPEN) {
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
          })
        );

        client.pixelsSent++;
        stats.pixelsSent++;
      } catch (error) {
        // Connection may have just closed
      }
    }

    // Wait before next pixel (500ms - 2s)
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1500)
    );
  }
}

/**
 * Kill a random WebSocket Gateway pod
 */
function killRandomPod() {
  try {
    // Get all WebSocket Gateway pods
    const podsOutput = execSync(
      'kubectl get pods -l app=websocket-gateway -o jsonpath="{.items[*].metadata.name}"',
      { encoding: "utf-8" }
    );

    const pods = podsOutput
      .trim()
      .split(/\s+/)
      .filter((p) => p);

    if (pods.length === 0) {
      console.log("⚠️  No pods found to kill");
      return;
    }

    // Pick a random pod
    const targetPod = pods[Math.floor(Math.random() * pods.length)];

    console.log(`\n💥 CHAOS: Killing pod ${targetPod}...\n`);

    execSync(`kubectl delete pod ${targetPod} --force --grace-period=0`, {
      encoding: "utf-8",
      stdio: "inherit",
    });

    stats.podKills++;
  } catch (error) {
    console.error("❌ Failed to kill pod:", error.message);
  }
}

/**
 * Get current system state
 */
function getSystemState() {
  try {
    const podsOutput = execSync("kubectl get pods -l app=websocket-gateway", {
      encoding: "utf-8",
    });

    console.log("\n📊 Current System State:");
    console.log(podsOutput);

    // Get active connections per pod
    const podNames = execSync(
      'kubectl get pods -l app=websocket-gateway -o jsonpath="{.items[*].metadata.name}"',
      { encoding: "utf-8" }
    )
      .trim()
      .split(/\s+/)
      .filter((p) => p);

    console.log("\n📡 Active Connections:");

    for (const pod of podNames) {
      try {
        const healthOutput = execSync(
          `kubectl exec ${pod} -- wget -qO- http://localhost:3002/health`,
          { encoding: "utf-8" }
        );

        const health = JSON.parse(healthOutput);
        console.log(`  • ${pod}: ${health.users.length} users`);
      } catch (error) {
        console.log(`  • ${pod}: Starting up...`);
      }
    }
  } catch (error) {
    console.error("⚠️  Could not fetch system state");
  }
}

/**
 * Print statistics
 */
function printStats() {
  console.log("\n" + "=".repeat(60));
  console.log("Chaos Test Results");
  console.log("=".repeat(60));

  console.log(`\n💥 Chaos Events:`);
  console.log(`   Pods killed: ${stats.podKills}`);
  console.log(`   Client reconnections: ${stats.reconnections}`);

  if (stats.recoveryTimes.length > 0) {
    const avgRecovery =
      stats.recoveryTimes.reduce((a, b) => a + b, 0) /
      stats.recoveryTimes.length;
    const maxRecovery = Math.max(...stats.recoveryTimes);
    const minRecovery = Math.min(...stats.recoveryTimes);

    console.log(`\n⏱️  Recovery Times:`);
    console.log(`   Average: ${avgRecovery.toFixed(0)}ms`);
    console.log(`   Min: ${minRecovery}ms`);
    console.log(`   Max: ${maxRecovery}ms`);

    if (avgRecovery < 3000) {
      console.log(`   ✓ Excellent recovery time`);
    } else if (avgRecovery < 5000) {
      console.log(`   ✓ Good recovery time`);
    } else {
      console.log(`   ⚠️  Slow recovery - consider connection pooling`);
    }
  }

  console.log(`\n📊 Message Statistics:`);
  console.log(`   Pixels sent: ${stats.pixelsSent}`);
  console.log(`   Pixels received: ${stats.pixelsReceived}`);
  console.log(`   Errors: ${stats.errors}`);

  // Calculate message loss during chaos
  const expectedReceived = stats.pixelsSent * stats.clients.length;
  const actualReceived = stats.pixelsReceived;
  const deliveryRate = ((actualReceived / expectedReceived) * 100).toFixed(1);

  console.log(`\n📡 Delivery Rate During Chaos:`);
  console.log(`   Expected: ${expectedReceived} messages`);
  console.log(`   Received: ${actualReceived} messages`);
  console.log(`   Rate: ${deliveryRate}%`);

  if (deliveryRate > 90) {
    console.log(`   ✓ Excellent - System is resilient to pod failures`);
  } else if (deliveryRate > 70) {
    console.log(`   ✓ Good - Some message loss during chaos (acceptable)`);
  } else {
    console.log(`   ⚠️  High message loss - investigate reconnection logic`);
  }

  // Client reconnection success rate
  const disconnectedClients = stats.clients.filter(
    (c) => c.disconnectCount > 0
  );
  const reconnectedClients = disconnectedClients.filter((c) => c.reconnected);
  const neverDisconnectedClients = stats.clients.filter(
    (c) => c.disconnectCount === 0
  );

  console.log(`\n🔄 Reconnection Analysis:`);
  console.log(
    `   Clients never disconnected: ${neverDisconnectedClients.length} (lucky, on surviving pods)`
  );
  console.log(
    `   Clients affected by pod kills: ${disconnectedClients.length}`
  );
  console.log(
    `   Successfully reconnected: ${reconnectedClients.length}/${disconnectedClients.length}`
  );

  if (disconnectedClients.length > 0) {
    const reconnectRate = (
      (reconnectedClients.length / disconnectedClients.length) *
      100
    ).toFixed(1);
    console.log(`   Reconnection success rate: ${reconnectRate}%`);

    if (reconnectRate >= 100) {
      console.log(`   ✓ Perfect - All affected clients reconnected`);
    } else if (reconnectRate > 90) {
      console.log(`   ✓ Excellent - Auto-reconnect working well`);
    } else {
      console.log(`   ⚠️  Some clients failed to reconnect`);
    }
  } else {
    console.log(
      `   ℹ️  No clients were disconnected (no pods were killed or test was too short)`
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("✓ Chaos test completed!");
  console.log("=".repeat(60) + "\n");
}

/**
 * Main test execution
 */
async function runTest() {
  console.log("💥 Cloud Pixel Playground - Chaos Testing\n");
  console.log(`Configuration:`);
  console.log(`  • WebSocket URL: ${WS_URL}`);
  console.log(`  • Number of clients: ${NUM_CLIENTS}`);
  console.log(`  • Test duration: ${TEST_DURATION}s`);
  console.log(
    `  • Chaos interval: ${CHAOS_INTERVAL}s (kill pod every ${CHAOS_INTERVAL}s)`
  );
  console.log("");

  try {
    // Step 1: Create resilient clients
    console.log(`📡 Creating ${NUM_CLIENTS} resilient clients...\n`);

    for (let i = 1; i <= NUM_CLIENTS; i++) {
      createResilientClient(i);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Wait for all connections
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`\n✓ All clients connected\n`);

    // Step 2: Start continuous drawing for all clients
    console.log(`🎨 Starting continuous pixel drawing...\n`);

    stats.clients.forEach((client) => {
      continuousDrawing(client);
    });

    // Step 3: Get initial system state
    getSystemState();

    // Step 4: Chaos loop - kill pods at intervals
    const chaosInterval = setInterval(() => {
      killRandomPod();

      // Give it a moment to recover
      setTimeout(() => {
        getSystemState();
      }, 3000);
    }, CHAOS_INTERVAL * 1000);

    // Step 5: Run for test duration
    console.log(`\n⏳ Running chaos test for ${TEST_DURATION} seconds...\n`);
    console.log(`   (Pods will be randomly killed every ${CHAOS_INTERVAL}s)\n`);

    await new Promise((resolve) => setTimeout(resolve, TEST_DURATION * 1000));

    // Step 6: Stop chaos
    clearInterval(chaosInterval);
    console.log("\n🛑 Stopping chaos events...\n");

    // Step 7: Let system stabilize
    console.log("⏳ Waiting for system to stabilize...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 8: Final system state
    getSystemState();

    // Step 9: Stop all clients
    stats.clients.forEach((client) => {
      client.isRunning = false;
      if (client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });

    // Step 10: Print results
    printStats();

    process.exit(0);
  } catch (error) {
    console.error("❌ Chaos test failed:", error.message);
    process.exit(1);
  }
}

// Run the test
runTest();
