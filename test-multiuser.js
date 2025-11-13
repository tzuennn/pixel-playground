#!/usr/bin/env node

/**
 * Multi-User Collaboration Test
 * 
 * This script simulates multiple users connecting to the WebSocket Gateway
 * and drawing on the canvas. It verifies that broadcasts work correctly.
 */

const WebSocket = require('ws');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:3002';
const NUM_USERS = parseInt(process.env.NUM_USERS) || 5;
const PIXELS_PER_USER = parseInt(process.env.PIXELS_PER_USER) || 3;
const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];

console.log('╔════════════════════════════════════════╗');
console.log('║  Multi-User Collaboration Test        ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log(`📊 Test Configuration:`);
console.log(`   WebSocket URL: ${WS_URL}`);
console.log(`   Users: ${NUM_USERS}`);
console.log(`   Pixels per user: ${PIXELS_PER_USER}`);
console.log(`   Total pixels: ${NUM_USERS * PIXELS_PER_USER}`);
console.log('');

// Test state
let connectedUsers = 0;
let totalPixelsSent = 0;
let totalPixelsReceived = 0;
const pixelsByUser = new Map();
const clients = [];
const startTime = Date.now();

// Create multiple user connections
for (let i = 0; i < NUM_USERS; i++) {
  const ws = new WebSocket(WS_URL);
  const userId = i + 1;
  const userColor = colors[i % colors.length];
  
  ws.userId = userId;
  ws.userColor = userColor;
  pixelsByUser.set(userId, { sent: 0, received: 0 });
  
  ws.on('open', () => {
    connectedUsers++;
    console.log(`✓ User ${userId} connected (${connectedUsers}/${NUM_USERS})`);
    
    // When all users connected, start drawing
    if (connectedUsers === NUM_USERS) {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎨 All users connected! Starting collaborative drawing...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      setTimeout(startDrawing, 1000);
    }
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'connected':
          // Initial connection message
          break;
          
        case 'pixel_updated':
          totalPixelsReceived++;
          const stats = pixelsByUser.get(userId);
          stats.received++;
          
          // Only log first few to avoid spam
          if (totalPixelsReceived <= 10) {
            console.log(`  👁️  User ${userId} saw: Pixel (${msg.x}, ${msg.y}) -> ${msg.color}`);
          }
          break;
          
        case 'stats':
          // Stats message with active user count
          if (msg.activeUsers) {
            console.log(`📊 Active users: ${msg.activeUsers}`);
          }
          break;
      }
    } catch (error) {
      console.error(`❌ User ${userId} failed to parse message:`, error.message);
    }
  });
  
  ws.on('error', (err) => {
    console.error(`❌ User ${userId} error:`, err.message);
  });
  
  ws.on('close', () => {
    console.log(`🔌 User ${userId} disconnected`);
  });
  
  clients.push(ws);
}

function startDrawing() {
  console.log('Drawing pixels from each user...');
  console.log('');
  
  // Each user draws pixels with a slight delay
  clients.forEach((ws, index) => {
    setTimeout(() => {
      const userId = ws.userId;
      const userStats = pixelsByUser.get(userId);
      
      for (let p = 0; p < PIXELS_PER_USER; p++) {
        const x = Math.floor(Math.random() * 50);
        const y = Math.floor(Math.random() * 50);
        const color = ws.userColor;
        
        try {
          ws.send(JSON.stringify({
            type: 'pixel_update',
            x, y, color
          }));
          
          totalPixelsSent++;
          userStats.sent++;
          
          console.log(`  ✏️  User ${userId} drew pixel at (${x}, ${y}) in ${color}`);
        } catch (error) {
          console.error(`  ❌ User ${userId} failed to send pixel:`, error.message);
        }
      }
    }, index * 200); // Stagger draws by 200ms per user
  });
  
  // Show results after drawing completes + buffer time
  const waitTime = (NUM_USERS * 200) + 3000;
  setTimeout(showResults, waitTime);
}

function showResults() {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║         Test Results                   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`👥 Connected Users: ${connectedUsers}/${NUM_USERS}`);
  console.log(`📤 Total Pixels Sent: ${totalPixelsSent}`);
  console.log(`📥 Total Pixels Received: ${totalPixelsReceived}`);
  console.log(`📊 Expected Broadcasts: ${totalPixelsSent * NUM_USERS}`);
  console.log('');
  
  // Per-user statistics
  console.log('Per-User Statistics:');
  console.log('─'.repeat(50));
  let allUsersGotMessages = true;
  
  pixelsByUser.forEach((stats, userId) => {
    const receivedFromOthers = stats.received - stats.sent;
    console.log(`  User ${userId}: Sent ${stats.sent}, Received ${stats.received} (${receivedFromOthers} from others)`);
    
    if (stats.received < totalPixelsSent * 0.8) {
      allUsersGotMessages = false;
    }
  });
  
  console.log('');
  
  // Determine test result
  const successRate = (totalPixelsReceived / (totalPixelsSent * NUM_USERS)) * 100;
  console.log(`📈 Broadcast Success Rate: ${successRate.toFixed(1)}%`);
  console.log('');
  
  if (connectedUsers === NUM_USERS && successRate >= 90) {
    console.log('✅ PASS: Multi-user collaboration works correctly!');
    console.log('   - All users connected successfully');
    console.log('   - Broadcasts reached all clients');
    console.log('   - Real-time synchronization verified');
  } else if (successRate >= 70) {
    console.log('⚠️  PARTIAL PASS: Multi-user collaboration mostly works');
    console.log(`   - Success rate: ${successRate.toFixed(1)}%`);
    console.log('   - Some messages may have been delayed or dropped');
  } else {
    console.log('❌ FAIL: Multi-user collaboration has issues');
    if (connectedUsers < NUM_USERS) {
      console.log(`   - Only ${connectedUsers}/${NUM_USERS} users connected`);
    }
    if (successRate < 70) {
      console.log(`   - Low success rate: ${successRate.toFixed(1)}%`);
    }
  }
  
  console.log('');
  console.log('To test visually, open multiple browser windows at:');
  console.log('  http://localhost:3000');
  console.log('');
  
  // Cleanup
  cleanup();
}

function cleanup() {
  console.log('🧹 Cleaning up...');
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
  
  setTimeout(() => {
    process.exit(successRate >= 90 ? 0 : 1);
  }, 1000);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\\n\\n⚠️  Test interrupted by user');
  cleanup();
});

// Timeout after 30 seconds
setTimeout(() => {
  console.error('\\n❌ Test timeout (30s exceeded)');
  cleanup();
}, 30000);
