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
    this.username = null;
    this.shouldReconnect = true;
    this.onStatusChange = null;
  }

  /**
   * Connect to WebSocket server
   * @param {Function} onStatusChange - Callback for status changes
   * @param {string} username - Username for this connection
   */
  connect(onStatusChange, username = null) {
    this.username = username;
    this.shouldReconnect = true;
    this.onStatusChange = onStatusChange;

    try {
      this.ws = new WebSocket(CONFIG.WS_URL);

      this.ws.onopen = () => {
        console.log("WebSocket connected");

        // Send username to server
        if (this.username) {
          this.send({
            type: "set_username",
            username: this.username,
          });
        }

        if (this.onStatusChange) {
          this.onStatusChange({ connected: true, text: "Connected" });
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
        console.log("WebSocket disconnected", "shouldReconnect:", this.shouldReconnect);
        
        // Only show disconnection status and attempt reconnect if it was unexpected
        if (this.shouldReconnect) {
          if (this.onStatusChange) {
            this.onStatusChange({ connected: false, text: "Disconnected" });
          }
          setTimeout(() => this.connect(this.onStatusChange, this.username), this.reconnectTimeout);
        } else {
          // Manual disconnect - just update status without error
          if (this.onStatusChange) {
            this.onStatusChange({ connected: false, text: "Disconnected", manual: true });
          }
        }
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
          username: this.username,
        })
      );
      return true;
    }
    return false;
  }

  /**
   * Send generic message
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Update username without reconnecting
   */
  updateUsername(newUsername) {
    this.username = newUsername;
    return this.send({
      type: "set_username",
      username: newUsername,
    });
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
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
