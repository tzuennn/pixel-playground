#!/bin/bash

# Quick Multi-User Demo Script
# Opens multiple browser windows to test real-time collaboration

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║  Cloud Pixel Playground - Multi-User Demo     ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check if services are running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "⚠️  Services not running. Starting them now..."
    echo ""
    
    cd "$(dirname "$0")"
    ./dev-local.sh &
    
    echo "⏳ Waiting for services to start (15 seconds)..."
    sleep 15
fi

# Verify services are up
echo "🔍 Checking services..."
services_ok=true

if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "  ✓ Canvas API: Running"
else
    echo "  ✗ Canvas API: Not responding"
    services_ok=false
fi

if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "  ✓ WebSocket Gateway: Running"
else
    echo "  ✗ WebSocket Gateway: Not responding"
    services_ok=false
fi

if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "  ✓ Frontend: Running"
else
    echo "  ✗ Frontend: Not responding"
    services_ok=false
fi

if [ "$services_ok" = false ]; then
    echo ""
    echo "❌ Some services are not running properly."
    echo "   Try running: ./scripts/dev-local.sh"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Opening browser windows for multi-user test..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Open 3 browser windows
echo "Opening Window 1..."
open http://localhost:3000
sleep 1

echo "Opening Window 2..."
open http://localhost:3000
sleep 1

echo "Opening Window 3..."
open http://localhost:3000

echo ""
echo "✅ Demo ready!"
echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  Testing Instructions                          ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "1. ⏳ Wait for all windows to show 'Connected'"
echo "   (Look for green indicator)"
echo ""
echo "2. 👥 Check user count shows '3 users online'"
echo "   (In status bar at top)"
echo ""
echo "3. 🎨 Draw in any window:"
echo "   • Click pixels to draw"
echo "   • Try different colors"
echo "   • Click and drag to draw lines"
echo ""
echo "4. 👀 Watch the magic:"
echo "   • Drawing appears in ALL windows instantly!"
echo "   • Try drawing in different windows simultaneously"
echo "   • Close one window and watch user count update"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Tips:"
echo "   • Use preset colors for quick color switching"
echo "   • Open even more windows for more fun!"
echo "   • Check browser console (F12) to see WebSocket messages"
echo ""
echo "🛑 To stop services:"
echo "   ./scripts/stop-local.sh"
echo ""
