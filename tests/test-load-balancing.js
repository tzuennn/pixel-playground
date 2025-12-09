/**
 * Load Balancing Test for Cloud Pixel Playground
 * 
 * This script demonstrates that:
 * 1. Multiple WebSocket Gateway pods are receiving connections
 * 2. Pixel updates broadcast across all pods via Redis Pub/Sub
 * 3. User stats are aggregated correctly across pods
 * 4. Load is distributed evenly by Kubernetes Service
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost/ws';
const API_URL = process.env.API_URL || 'http://localhost/api';
const NUM_CLIENTS = parseInt(process.env.NUM_CLIENTS) || 20;
const TEST_DURATION = parseInt(process.env.TEST_DURATION) || 30; // seconds
const PIXELS_PER_CLIENT = parseInt(process.env.PIXELS_PER_CLIENT) || 5;

// Stats tracking
const stats = {
  connectionsPerPod: new Map(),
  messagesReceived: 0,
  messagesSent: 0,
  pixelUpdates: 0,
  errors: 0,
  clients: []
};

// Colors for different clients
const COLORS = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
  '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#FFC0CB', '#A52A2A', '#808080', '#000000'
];

/**
 * Create a WebSocket client
 */
function createClient(clientId) {
  return new Promise((resolve, reject) => {
    const username = `LoadTest-${clientId}`;
    const ws = new WebSocket(WS_URL);
    let connected = false;
    let receivedPodInfo = false;
    
    const client = {
      id: clientId,
      ws,
      username,
      podId: null,
      pixelsDrawn: 0,
      pixelsReceived: 0
    };

    ws.on('open', () => {
      console.log(`✓ Client ${clientId} connected`);
      
      // Set username
      ws.send(JSON.stringify({
        type: 'set_username',
        username: username
      }));
      
      connected = true;
      stats.clients.push(client);
      resolve(client);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        stats.messagesReceived++;
        
        // Extract pod info from health check or logs
        // In production, you'd add pod ID to WebSocket messages
        if (message.type === 'connected') {
          client.connectedMessage = message;
        }
        
        if (message.type === 'pixel_updated') {
          client.pixelsReceived++;
          stats.pixelUpdates++;
        }
        
        if (message.type === 'stats') {
          // Track total user count reported
          client.lastUserCount = message.activeUsers;
        }
      } catch (error) {
        stats.errors++;
      }
    });

    ws.on('error', (error) => {
      console.error(`✗ Client ${clientId} error:`, error.message);
      stats.errors++;
      if (!connected) {
        reject(error);
      }
    });

    ws.on('close', () => {
      console.log(`✗ Client ${clientId} disconnected`);
    });

    // Timeout for connection
    setTimeout(() => {
      if (!connected) {
        reject(new Error(`Client ${clientId} connection timeout`));
      }
    }, 5000);
  });
}

/**
 * Draw random pixels for a client
 */
async function drawPixels(client) {
  const color = COLORS[client.id % COLORS.length];
  
  for (let i = 0; i < PIXELS_PER_CLIENT; i++) {
    const x = Math.floor(Math.random() * 50);
    const y = Math.floor(Math.random() * 50);
    
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'pixel_update',
        x, y, color,
        username: client.username
      }));
      
      client.pixelsDrawn++;
      stats.messagesSent++;
      
      // Random delay between pixels (50-200ms)
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
    }
  }
}

/**
 * Get WebSocket Gateway pod distribution
 */
async function getPodDistribution() {
  try {
    console.log('\n📊 Checking pod distribution...\n');
    
    // Get pod names and logs
    const { execSync } = require('child_process');
    
    // Get pod names
    const podsOutput = execSync(
      'kubectl get pods -l app=websocket-gateway -o jsonpath="{.items[*].metadata.name}"',
      { encoding: 'utf-8' }
    );
    
    const pods = podsOutput.trim().split(/\s+/);
    console.log(`Found ${pods.length} WebSocket Gateway pods:`);
    
    for (const pod of pods) {
      // Get connection count from pod logs
      try {
        const logs = execSync(
          `kubectl logs ${pod} --tail=100 | grep -c "New client connected" || echo 0`,
          { encoding: 'utf-8' }
        );
        
        const connections = parseInt(logs.trim()) || 0;
        stats.connectionsPerPod.set(pod, connections);
        console.log(`  • ${pod}: ${connections} connections (from logs)`);
      } catch (error) {
        console.log(`  • ${pod}: Unable to fetch stats`);
      }
    }
    
    // Get current active connections from health endpoint
    console.log('\n📡 Current active connections per pod:\n');
    
    for (const pod of pods) {
      try {
        const healthOutput = execSync(
          `kubectl exec ${pod} -- wget -qO- http://localhost:3002/health`,
          { encoding: 'utf-8' }
        );
        
        const health = JSON.parse(healthOutput);
        console.log(`  • ${pod}: ${health.connections} active connections`);
        console.log(`    Users: ${health.users.join(', ') || 'none'}`);
      } catch (error) {
        console.log(`  • ${pod}: Health check failed`);
      }
    }
    
  } catch (error) {
    console.error('⚠️  Could not fetch pod distribution (kubectl may not be available)');
    console.error('   Continuing with client-side metrics only...');
  }
}

/**
 * Verify load balancing
 */
function verifyLoadBalancing() {
  console.log('\n' + '='.repeat(60));
  console.log('Load Balancing Verification');
  console.log('='.repeat(60));
  
  const totalConnections = Array.from(stats.connectionsPerPod.values())
    .reduce((sum, count) => sum + count, 0);
  
  if (stats.connectionsPerPod.size > 0) {
    console.log(`\n✓ Connections distributed across ${stats.connectionsPerPod.size} pods\n`);
    
    stats.connectionsPerPod.forEach((count, pod) => {
      const percentage = ((count / totalConnections) * 100).toFixed(1);
      const bar = '█'.repeat(Math.ceil(count / 2));
      console.log(`  ${pod}: ${bar} ${count} (${percentage}%)`);
    });
    
    // Check distribution fairness
    const counts = Array.from(stats.connectionsPerPod.values());
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const maxDeviation = Math.max(...counts.map(c => Math.abs(c - avg)));
    const deviationPercent = (maxDeviation / avg * 100).toFixed(1);
    
    console.log(`\n📊 Distribution Analysis:`);
    console.log(`   Average: ${avg.toFixed(1)} connections per pod`);
    console.log(`   Max deviation: ${deviationPercent}%`);
    
    if (deviationPercent < 30) {
      console.log(`   ✓ Load is well balanced`);
    } else {
      console.log(`   ⚠️  Load distribution could be improved`);
    }
  } else {
    console.log('⚠️  Could not verify pod distribution (requires kubectl access)');
  }
}

/**
 * Print final statistics
 */
function printStats() {
  console.log('\n' + '='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));
  
  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Clients created: ${stats.clients.length}/${NUM_CLIENTS}`);
  console.log(`   Messages sent: ${stats.messagesSent}`);
  console.log(`   Messages received: ${stats.messagesReceived}`);
  console.log(`   Pixel updates broadcast: ${stats.pixelUpdates}`);
  console.log(`   Errors: ${stats.errors}`);
  
  // Calculate broadcast effectiveness
  const expectedBroadcasts = stats.clients.length * PIXELS_PER_CLIENT * stats.clients.length;
  const actualBroadcasts = stats.pixelUpdates;
  const effectiveness = ((actualBroadcasts / expectedBroadcasts) * 100).toFixed(1);
  
  console.log(`\n📡 Broadcast Effectiveness:`);
  console.log(`   Expected: ${expectedBroadcasts} pixel updates`);
  console.log(`   Received: ${actualBroadcasts} pixel updates`);
  console.log(`   Rate: ${effectiveness}%`);
  
  if (effectiveness > 90) {
    console.log(`   ✓ Excellent - Redis Pub/Sub working correctly`);
  } else if (effectiveness > 70) {
    console.log(`   ✓ Good - Some message loss (acceptable)`);
  } else {
    console.log(`   ⚠️  Low - Check Redis Pub/Sub configuration`);
  }
  
  // User count verification
  const reportedCounts = stats.clients
    .map(c => c.lastUserCount)
    .filter(c => c !== undefined);
  
  if (reportedCounts.length > 0) {
    const avgReported = reportedCounts.reduce((a, b) => a + b, 0) / reportedCounts.length;
    console.log(`\n👥 User Count Aggregation:`);
    console.log(`   Actual clients: ${stats.clients.length}`);
    console.log(`   Reported average: ${avgReported.toFixed(1)}`);
    
    const accuracy = ((avgReported / stats.clients.length) * 100).toFixed(1);
    if (accuracy > 90) {
      console.log(`   ✓ User counts aggregated correctly (${accuracy}%)`);
    } else {
      console.log(`   ⚠️  User count aggregation may have issues (${accuracy}%)`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✓ Load balancing test completed!');
  console.log('='.repeat(60) + '\n');
}

/**
 * Main test execution
 */
async function runTest() {
  console.log('🚀 Cloud Pixel Playground - Load Balancing Test\n');
  console.log(`Configuration:`);
  console.log(`  • WebSocket URL: ${WS_URL}`);
  console.log(`  • API URL: ${API_URL}`);
  console.log(`  • Number of clients: ${NUM_CLIENTS}`);
  console.log(`  • Test duration: ${TEST_DURATION}s`);
  console.log(`  • Pixels per client: ${PIXELS_PER_CLIENT}`);
  console.log('');

  try {
    // Step 1: Create all clients
    console.log(`📡 Connecting ${NUM_CLIENTS} clients...\n`);
    
    const clientPromises = [];
    for (let i = 1; i <= NUM_CLIENTS; i++) {
      clientPromises.push(createClient(i));
      // Stagger connections to simulate real-world scenario
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await Promise.all(clientPromises);
    console.log(`\n✓ All ${stats.clients.length} clients connected\n`);
    
    // Step 2: Check pod distribution
    await getPodDistribution();
    
    // Step 3: All clients draw pixels simultaneously
    console.log(`\n🎨 Clients drawing pixels...\n`);
    
    const drawPromises = stats.clients.map(client => drawPixels(client));
    await Promise.all(drawPromises);
    
    console.log(`\n✓ All clients finished drawing\n`);
    
    // Step 4: Wait for messages to propagate
    console.log(`⏳ Waiting for messages to propagate...\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Check pod distribution again
    await getPodDistribution();
    
    // Step 6: Verify load balancing
    verifyLoadBalancing();
    
    // Step 7: Print statistics
    printStats();
    
    // Cleanup
    console.log('🧹 Closing connections...\n');
    stats.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest();
