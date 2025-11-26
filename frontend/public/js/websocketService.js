/**
 * WebSocket Service Module
 * Handles WebSocket connection and message handling
 */

import { CONFIG } from "./config.js";

export class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectTimeout = 3000;
    this.messageHandlers = new Map();
  }

  /**
   * Connect to WebSocket server
   */
  connect(onStatusChange) {
    try {
      this.ws = new WebSocket(CONFIG.WS_URL);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        if (onStatusChange) {
          onStatusChange({ connected: true, text: "Connected" });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        if (onStatusChange) {
          onStatusChange({ connected: false, text: "Disconnected" });
        }

        // Attempt to reconnect
        setTimeout(() => this.connect(onStatusChange), this.reconnectTimeout);
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      throw new Error(
        "Failed to connect. Please check if the server is running."
      );
    }
  }

  /**
   * Register a message handler for a specific message type
   */
  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(message) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  /**
   * Send pixel update
   */
  sendPixelUpdate(x, y, color) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "pixel_update",
          x,
          y,
          color,
        })
      );
      return true;
    }
    return false;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
