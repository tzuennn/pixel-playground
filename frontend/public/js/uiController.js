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
      errorContainer: document.getElementById("errorContainer"),
      colorPicker: document.getElementById("colorPicker"),
      canvas: document.getElementById("canvas"),
    };

    this.errorTimeout = null;
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
}
