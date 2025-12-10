/**
 * Main Application Module
 * Orchestrates all components and handles application logic
 */

import { CanvasManager } from "./canvasManager.js";
import { ApiService } from "./apiService.js";
import { WebSocketService } from "./websocketService.js";
import { UIController } from "./uiController.js";

class PixelPlaygroundApp {
  constructor() {
    this.canvasManager = null;
    this.wsService = null;
    this.uiController = null;
    this.isDrawing = false;
    this.currentUsername = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Initialize UI controller
      this.uiController = new UIController();

      // Initialize canvas manager
      const canvas = document.getElementById("canvas");
      this.canvasManager = new CanvasManager(canvas);

      // Load canvas data
      await this.loadCanvas();

      // Connect WebSocket
      this.connectWebSocket();

      // Setup event listeners
      this.setupEventListeners();

      console.log("Application initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      this.uiController.showError(
        "Failed to initialize application: " + error.message
      );
    }
  }

  /**
   * Load canvas from API
   */
  async loadCanvas() {
    try {
      this.uiController.updateStatus({
        connected: false,
        text: "Loading canvas...",
      });

      const canvasData = await ApiService.loadCanvas();
      this.canvasManager.setCanvasData(canvasData);
      this.canvasManager.drawCanvas();

      this.uiController.updateStatus({
        connected: false,
        text: "Canvas loaded",
      });
    } catch (error) {
      this.uiController.showError(error.message);
      throw error;
    }
  }

  /**
   * Connect to WebSocket
   */
  connectWebSocket() {
    this.wsService = new WebSocketService();

    // Get username from user
    this.currentUsername = this.uiController.promptUsername();
    const username = this.currentUsername;

    // Handle status changes
    this.wsService.connect((status) => {
      this.uiController.updateStatus(status);
      if (status.connected) {
        this.uiController.clearError();
      } else if (!status.manual) {
        // Only show error for unexpected disconnects, not manual username changes
        this.uiController.showError("Connection error. Retrying...");
      }
    }, this.currentUsername);

    // Handle different message types
    this.wsService.on("connected", (message) => {
      console.log("Connected to server:", message.message);
    });

    this.wsService.on("pixel_updated", (message) => {
      const { x, y, color, username: editorUsername } = message;
      this.canvasManager.updatePixel(x, y, color);

      // Show who's drawing (skip if it's the current user)
      if (editorUsername && editorUsername !== this.currentUsername) {
        this.uiController.showDrawingIndicator(editorUsername, x, y, color);
      }
    });

    this.wsService.on("stats", (message) => {
      this.uiController.updateUserCount(message.activeUsers);
    });

    this.wsService.on("user_list", (message) => {
      if (message.users) {
        this.uiController.updateActiveUsers(message.users);
      }
    });

    this.wsService.on("error", (message) => {
      this.uiController.showError(message.message);
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const canvas = this.canvasManager.canvas;

    // Mouse events
    canvas.addEventListener("mousedown", (e) => this.handleDrawStart(e));
    canvas.addEventListener("mousemove", (e) => this.handleDrawMove(e));
    canvas.addEventListener("mouseup", () => this.handleDrawEnd());
    canvas.addEventListener("mouseleave", () => this.handleDrawEnd());

    // Touch events
    canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e));
    canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e));
    canvas.addEventListener("touchend", () => this.handleDrawEnd());

    // Preset colors
    this.uiController.setupPresetColors();

    // Edit username button
    const editUsernameBtn = document.getElementById("editUsernameBtn");
    if (editUsernameBtn) {
      editUsernameBtn.addEventListener("click", () =>
        this.handleEditUsername()
      );
    }
  }

  /**
   * Handle draw start
   */
  handleDrawStart(event) {
    this.isDrawing = true;
    this.updatePixel(event);
  }

  /**
   * Handle draw move
   */
  handleDrawMove(event) {
    if (this.isDrawing) {
      this.updatePixel(event);
    }
  }

  /**
   * Handle draw end
   */
  handleDrawEnd() {
    this.isDrawing = false;
  }

  /**
   * Handle touch start
   */
  handleTouchStart(event) {
    event.preventDefault();
    this.isDrawing = true;

    const touch = event.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.updatePixel(mouseEvent);
  }

  /**
   * Handle touch move
   */
  handleTouchMove(event) {
    event.preventDefault();

    if (this.isDrawing) {
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      this.updatePixel(mouseEvent);
    }
  }

  /**
   * Update pixel
   */
  updatePixel(event) {
    const { x, y } = this.canvasManager.getPixelCoordinates(event);

    if (this.canvasManager.isValidCoordinates(x, y)) {
      const color = this.uiController.getCurrentColor();

      if (this.wsService.sendPixelUpdate(x, y, color)) {
        // Optimistic update
        this.canvasManager.updatePixel(x, y, color);
      } else {
        this.uiController.showError("Not connected to server");
      }
    }
  }

  /**
   * Handle edit username
   */
  handleEditUsername() {
    const newUsername = this.uiController.editUsername();
    if (newUsername && this.wsService) {
      // Update username on existing connection (no disconnect needed!)
      if (this.wsService.updateUsername(newUsername)) {
        // Update the username reference
        this.currentUsername = newUsername;
      } else {
        this.uiController.showError(
          "Failed to update username. Not connected."
        );
      }
    }
  }
}

// Initialize application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const app = new PixelPlaygroundApp();
    app.init();
  });
} else {
  const app = new PixelPlaygroundApp();
  app.init();
}
