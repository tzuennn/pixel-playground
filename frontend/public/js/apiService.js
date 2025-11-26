/**
 * API Service Module
 * Handles all HTTP API calls
 */

import { CONFIG } from "./config.js";

export class ApiService {
  /**
   * Load canvas data from API
   */
  static async loadCanvas() {
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/canvas`);

      if (!response.ok) {
        throw new Error("Failed to load canvas");
      }

      const data = await response.json();
      return data.pixels;
    } catch (error) {
      console.error("Error loading canvas:", error);
      throw new Error("Failed to load canvas. Please refresh the page.");
    }
  }

  /**
   * Clear/reset canvas
   */
  static async resetCanvas() {
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/canvas/reset`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to clear canvas");
      }

      return true;
    } catch (error) {
      console.error("Error clearing canvas:", error);
      throw new Error("Failed to clear canvas");
    }
  }
}
