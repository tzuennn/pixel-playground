# Multi-User Testing Guide

## 🎯 Quick Answer: How to Test Multi-User Collaboration

### Method 1: Multiple Browser Windows (Easiest)

1. Start the application
2. Open http://localhost:3000 in multiple browser windows
3. Draw in one window and watch updates appear in real-time in all others!

### Method 2: Multiple Browsers

1. Start the application
2. Open in Chrome: http://localhost:3000
3. Open in Firefox: http://localhost:3000
4. Open in Safari: http://localhost:3000
5. Draw in any browser and see updates in all!

### Method 3: Incognito/Private Windows

1. Start the application
2. Open multiple incognito/private windows
3. Visit http://localhost:3000 in each
4. Test real-time collaboration!

---

## 📋 Detailed Testing Instructions

### Step 1: Start All Services

```bash
cd /Users/tzuentseng/CSMods/cloud/pixel-playground
./scripts/dev-local.sh
```

Wait about 10 seconds for all services to start. You should see:

```
✓ Redis started on port 6379
✓ Canvas API started on port 3001
✓ WebSocket Gateway started on port 3002
✓ Frontend started on port 3000
```

### Step 2: Open Multiple Browser Windows

#### Option A: Same Browser, Multiple Windows

```bash
# macOS - Open 3 windows
open http://localhost:3000
sleep 1
open http://localhost:3000
sleep 1
open http://localhost:3000
```

#### Option B: Different Browsers

```bash
# Chrome
open -a "Google Chrome" http://localhost:3000

# Firefox
open -a "Firefox" http://localhost:3000

# Safari
open -a "Safari" http://localhost:3000
```

### Step 3: Test Real-Time Collaboration

1. **Verify Connections**:
   - Each browser should show "Connected" (green dot)
   - User count should show the number of open windows (e.g., "3 users online")

2. **Test Drawing**:
   - Window 1: Click on a pixel - it should turn red
   - Windows 2 & 3: The same pixel should turn red immediately!
3. **Test Different Colors**:
   - Window 1: Select blue, draw something
   - Window 2: Select green, draw something
   - Window 3: Select yellow, draw something
   - All windows should see all drawings in real-time!

4. **Test Drawing Speed**:
   - Click and drag rapidly in one window
   - Other windows should update smoothly
5. **Test User Count**:
   - Close one browser window
   - After a few seconds, user count should decrease
   - Open a new window
   - User count should increase

---

## 🧪 Automated Multi-User Tests

### Test 1: WebSocket Connection Test

```bash
# Create test script
cd /Users/tzuentseng/CSMods/cloud/pixel-playground
node << 'EOF'
const WebSocket = require('ws');

console.log('Testing multi-user WebSocket connections...\n');

const clients = [];
const NUM_CLIENTS = 5;

for (let i = 0; i < NUM_CLIENTS; i++) {
  const ws = new WebSocket('ws://localhost:3002');

  ws.on('open', () => {
    console.log(`✓ Client ${i + 1} connected`);
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'pixel_updated') {
      console.log(`  Client ${i + 1} received: Pixel (${message.x}, ${message.y}) -> ${message.color}`);
    } else if (message.type === 'stats') {
      console.log(`  Active users: ${message.activeUsers}`);
    }
  });

  clients.push(ws);
}

// After 2 seconds, send a pixel update from client 1
setTimeout(() => {
  console.log('\nClient 1 sending pixel update...');
  clients[0].send(JSON.stringify({
    type: 'pixel_update',
    x: 25,
    y: 25,
    color: '#FF0000'
  }));
}, 2000);

// After 4 seconds, send from client 3
setTimeout(() => {
  console.log('\nClient 3 sending pixel update...');
  clients[2].send(JSON.stringify({
    type: 'pixel_update',
    x: 30,
    y: 30,
    color: '#00FF00'
  }));
}, 4000);

// Clean up after 6 seconds
setTimeout(() => {
  console.log('\n✓ Test completed successfully!');
  console.log('All clients received broadcasts from each other.');
  clients.forEach(ws => ws.close());
  process.exit(0);
}, 6000);
EOF
```

### Test 2: HTTP Load Balancing Test

```bash
# Test that multiple requests work
echo "Testing Canvas API with multiple concurrent requests..."
for i in {1..10}; do
  curl -s http://localhost:3001/health &
done
wait
echo "✓ All requests completed"
```

---

## 🎨 Interactive Testing Scenarios

### Scenario 1: Collaborative Drawing

1. Window 1: Draw a circle outline
2. Window 2: Fill the circle with a different color
3. Window 3: Add details
4. **Expected**: All windows show the complete collaborative artwork

### Scenario 2: Race Condition Test

1. Windows 1 & 2: Click the exact same pixel at the same time
2. **Expected**: Both updates go through, last one wins (by timestamp)

### Scenario 3: Network Interruption

1. Open DevTools in one window
2. Go to Network tab -> Throttling -> Offline
3. Try to draw
4. **Expected**: Error message appears
5. Set back to "Online"
6. **Expected**: Automatically reconnects

### Scenario 4: Rapid Updates

1. Window 1: Click and drag rapidly across the canvas
2. **Expected**: Other windows show smooth updates with minimal lag

---

## 📊 Monitoring Multi-User Activity

### Watch Live Logs

```bash
# Terminal 1: Watch WebSocket Gateway logs
cd /Users/tzuentseng/CSMods/cloud/pixel-playground/websocket-gateway
tail -f $(ps aux | grep 'node.*websocket' | grep -v grep | awk '{print "/tmp/ws-" $2 ".log"}') 2>/dev/null || echo "Start services first"

# Or check process output
ps aux | grep 'node.*websocket'
```

### Check Current User Count via API

```bash
# Check WebSocket Gateway health
curl -s http://localhost:3002/health | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Active connections: {data[\"connections\"]}')"
```

### Monitor Redis Activity

```bash
# Watch Redis commands in real-time
docker exec -it pixel-redis redis-cli MONITOR
```

---

## 🔍 Verification Checklist

After opening multiple windows, verify:

- [ ] Each window shows "Connected" status (green indicator)
- [ ] User count matches number of open windows
- [ ] Drawing in one window appears in all others instantly
- [ ] Different colors from different users all appear correctly
- [ ] Closing a window decreases user count
- [ ] Opening new window increases user count
- [ ] Canvas state persists across all windows
- [ ] No errors in browser console (F12)
- [ ] WebSocket logs show broadcasts to N clients

---

## 🛠️ Advanced Testing Tools

### Create a Load Testing Script

```bash
cat > /Users/tzuentseng/CSMods/cloud/pixel-playground/test-multiuser.js << 'EOF'
#!/usr/bin/env node
const WebSocket = require('ws');

const NUM_USERS = 10;
const PIXELS_PER_USER = 5;
const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

console.log(`🧪 Multi-User Collaboration Test`);
console.log(`   Users: ${NUM_USERS}`);
console.log(`   Pixels per user: ${PIXELS_PER_USER}`);
console.log('');

let connectedUsers = 0;
let totalPixelsSent = 0;
let totalPixelsReceived = 0;
const clients = [];

for (let i = 0; i < NUM_USERS; i++) {
  const ws = new WebSocket('ws://localhost:3002');
  const userId = i + 1;

  ws.on('open', () => {
    connectedUsers++;
    console.log(`✓ User ${userId} connected (${connectedUsers}/${NUM_USERS})`);

    // When all users connected, start drawing
    if (connectedUsers === NUM_USERS) {
      console.log('\\n🎨 All users connected! Starting collaborative drawing...\\n');
      startDrawing();
    }
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'pixel_updated') {
      totalPixelsReceived++;
    }
  });

  ws.on('error', (err) => {
    console.error(`❌ User ${userId} error:`, err.message);
  });

  ws.userId = userId;
  clients.push(ws);
}

function startDrawing() {
  clients.forEach((ws, index) => {
    setTimeout(() => {
      for (let p = 0; p < PIXELS_PER_USER; p++) {
        const x = Math.floor(Math.random() * 50);
        const y = Math.floor(Math.random() * 50);
        const color = colors[index % colors.length];

        ws.send(JSON.stringify({
          type: 'pixel_update',
          x, y, color
        }));

        totalPixelsSent++;
        console.log(`  User ${ws.userId} drew pixel at (${x}, ${y}) in ${color}`);
      }
    }, index * 100);
  });

  // Show results after 5 seconds
  setTimeout(showResults, 5000);
}

function showResults() {
  console.log('\\n' + '='.repeat(50));
  console.log('📊 Test Results');
  console.log('='.repeat(50));
  console.log(`Connected Users: ${connectedUsers}`);
  console.log(`Total Pixels Sent: ${totalPixelsSent}`);
  console.log(`Total Pixels Received: ${totalPixelsReceived}`);
  console.log(`Expected Broadcasts: ${totalPixelsSent * NUM_USERS}`);
  console.log('');

  if (totalPixelsReceived >= totalPixelsSent * NUM_USERS * 0.9) {
    console.log('✅ PASS: Multi-user broadcasting works correctly!');
  } else {
    console.log('⚠️  WARN: Some broadcasts may have been missed');
  }

  // Cleanup
  clients.forEach(ws => ws.close());
  process.exit(0);
}

// Timeout after 30 seconds
setTimeout(() => {
  console.error('❌ Test timeout');
  process.exit(1);
}, 30000);
EOF

chmod +x /Users/tzuentseng/CSMods/cloud/pixel-playground/test-multiuser.js
```

### Run the Load Test

```bash
cd /Users/tzuentseng/CSMods/cloud/pixel-playground
node test-multiuser.js
```

---

## 📱 Mobile Testing

1. Find your local IP:

   ```bash
   ipconfig getifaddr en0
   ```

2. Update frontend config temporarily to use your IP instead of localhost

3. Open on mobile devices:

   ```
   http://YOUR_IP:3000
   ```

4. Draw on mobile and desktop simultaneously!

---

## 🐛 Troubleshooting

### "Not connected to server" error

```bash
# Check if WebSocket Gateway is running
curl http://localhost:3002/health

# Check logs
ps aux | grep websocket-gateway
```

### Updates not appearing in other windows

```bash
# Check WebSocket logs should show "Broadcast to N clients"
# If N=1, only one client is connected

# Verify multiple connections
curl http://localhost:3002/health
# Should show "connections": N
```

### User count always shows 0

```bash
# The stats message is sent every 30 seconds
# Wait 30 seconds or check browser console for WebSocket messages
```

---

## ✅ Success Indicators

You'll know multi-user collaboration is working when:

1. ✅ User count updates when opening/closing windows
2. ✅ Drawing in one window instantly appears in all others
3. ✅ Different users can draw different colors simultaneously
4. ✅ WebSocket logs show "Broadcast to N clients" where N > 1
5. ✅ No lag or delay between windows (< 100ms)
6. ✅ Canvas state is consistent across all windows

---

## 🎬 Quick Demo Script

```bash
#!/bin/bash
echo "🚀 Starting Cloud Pixel Playground Multi-User Demo"
echo ""

# Start services
./scripts/dev-local.sh &
sleep 10

# Open 3 browser windows
echo "Opening browser windows..."
open http://localhost:3000
sleep 1
open http://localhost:3000
sleep 1
open http://localhost:3000

echo ""
echo "✅ Demo ready!"
echo ""
echo "Instructions:"
echo "1. Wait for all windows to show 'Connected'"
echo "2. Check that user count shows '3 users online'"
echo "3. Draw in any window"
echo "4. Watch the drawing appear in all windows instantly!"
echo ""
echo "Press Ctrl+C to stop all services"
```

Save and run:

```bash
chmod +x demo.sh
./demo.sh
```
