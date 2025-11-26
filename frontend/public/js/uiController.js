/**
 * UI Controller Module
 * Handles all UI interactions and updates
 */

export class UIController {
  constructor() {
    this.elements = {
      statusIndicator: document.getElementById("statusIndicator"),
      statusText: document.getElementById("statusText"),
      userCount: document.getElementById("userCount"),
      activeUsersList: document.getElementById("activeUsersList"),
      errorContainer: document.getElementById("errorContainer"),
      colorPicker: document.getElementById("colorPicker"),
      canvas: document.getElementById("canvas"),
    };

    this.errorTimeout = null;
    this.drawingIndicators = new Map(); // Track drawing indicators by username
    this.indicatorTimeouts = new Map(); // Track timeouts for auto-hiding
  }

  /**
   * Update connection status
   */
  updateStatus({ connected, text }) {
    if (connected) {
      this.elements.statusIndicator.classList.add("connected");
    } else {
      this.elements.statusIndicator.classList.remove("connected");
    }
    this.elements.statusText.textContent = text;
  }

  /**
   * Update user count
   */
  updateUserCount(count) {
    this.elements.userCount.textContent = count;
  }

  /**
   * Show error message
   */
  showError(message) {
    this.elements.errorContainer.innerHTML = `<div class="error">${message}</div>`;

    // Clear previous timeout
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
    }

    // Auto-hide after 5 seconds
    this.errorTimeout = setTimeout(() => this.clearError(), 5000);
  }

  /**
   * Clear error message
   */
  clearError() {
    this.elements.errorContainer.innerHTML = "";
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }
  }

  /**
   * Get current selected color
   */
  getCurrentColor() {
    return this.elements.colorPicker.value.toUpperCase();
  }

  /**
   * Set up preset color buttons
   */
  setupPresetColors() {
    document.querySelectorAll(".preset-color").forEach((element) => {
      element.addEventListener("click", () => {
        const color = element.dataset.color;
        this.elements.colorPicker.value = color;

        // Update active state
        document
          .querySelectorAll(".preset-color")
          .forEach((el) => el.classList.remove("active"));
        element.classList.add("active");
      });
    });
  }

  /**
   * Show confirmation dialog
   */
  confirm(message) {
    return window.confirm(message);
  }

  /**
   * Prompt for username
   */
  promptUsername() {
    // Check localStorage first
    let username = localStorage.getItem("pixelPlaygroundUsername");
    
    if (!username) {
      username = window.prompt(
        "Enter your username:",
        `User${Math.floor(Math.random() * 1000)}`
      );
      
      if (username && username.trim()) {
        username = username.trim().substring(0, 20); // Limit length
        localStorage.setItem("pixelPlaygroundUsername", username);
      } else {
        username = `Guest${Math.floor(Math.random() * 10000)}`;
      }
    }
    
    return username;
  }

  /**
   * Edit username (for demo/testing)
   */
  editUsername() {
    const currentUsername = localStorage.getItem("pixelPlaygroundUsername") || "";
    const newUsername = window.prompt(
      "Enter new username:",
      currentUsername
    );
    
    if (newUsername && newUsername.trim()) {
      const sanitized = newUsername.trim().substring(0, 20);
      localStorage.setItem("pixelPlaygroundUsername", sanitized);
      return sanitized;
    }
    
    return null;
  }  /**
   * Update active users list
   */
  updateActiveUsers(users) {
    if (!this.elements.activeUsersList) return;

    this.elements.activeUsersList.innerHTML = users
      .map(
        (user) => `
        <div class="user-item" title="${this.escapeHtml(user)}">
          <span class="user-indicator"></span>
          <span class="user-name">${this.escapeHtml(user)}</span>
        </div>
      `
      )
      .join("");
  }

  /**
   * Show drawing indicator for a user
   */
  showDrawingIndicator(username, x, y, color) {
    if (!username) return;
    
    const canvas = this.elements.canvas;
    const canvasContainer = document.querySelector(".canvas-container");
    if (!canvas || !canvasContainer) return;
    
    // Calculate accurate position based on canvas rect
    const rect = canvas.getBoundingClientRect();
    const containerRect = canvasContainer.getBoundingClientRect();
    const pixelSize = canvas.width / 50; // 50x50 grid
    const scale = rect.width / canvas.width; // Handle any CSS scaling
    
    // Position relative to canvas container
    const leftPos = (canvas.offsetLeft + (x * pixelSize * scale) + (pixelSize * scale / 2));
    const topPos = (canvas.offsetTop + (y * pixelSize * scale));
    
    // Clear any existing timeout for this user
    if (this.indicatorTimeouts.has(username)) {
      clearTimeout(this.indicatorTimeouts.get(username));
    }
    
    // Get or create indicator
    let indicator = this.drawingIndicators.get(username);
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.className = "drawing-indicator";
      indicator.textContent = this.escapeHtml(username);
      canvasContainer.appendChild(indicator);
      this.drawingIndicators.set(username, indicator);
    }
    
    // Update position and color (smooth updates during drag)
    indicator.style.left = `${leftPos}px`;
    indicator.style.top = `${topPos}px`;
    indicator.style.borderColor = color;
    indicator.style.opacity = '1';
    
    // Auto-hide after 1.5 seconds of inactivity
    const timeout = setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => this.hideDrawingIndicator(username), 300);
    }, 1500);
    
    this.indicatorTimeouts.set(username, timeout);
  }  /**
   * Hide drawing indicator for a user
   */
  hideDrawingIndicator(username) {
    // Clear timeout
    if (this.indicatorTimeouts.has(username)) {
      clearTimeout(this.indicatorTimeouts.get(username));
      this.indicatorTimeouts.delete(username);
    }
    
    // Remove indicator
    const indicator = this.drawingIndicators.get(username);
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
      this.drawingIndicators.delete(username);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
