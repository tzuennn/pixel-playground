/**
 * Canvas Manager Module
 * Handles all canvas rendering and drawing operations
 */

import { CANVAS_SIZE, PIXEL_SIZE } from "./config.js";

export class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.canvasData = {};
  }

  /**
   * Set canvas data
   */
  setCanvasData(data) {
    this.canvasData = data;
  }

  /**
   * Get canvas data
   */
  getCanvasData() {
    return this.canvasData;
  }

  /**
   * Draw entire canvas
   */
  drawCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        const key = `${x},${y}`;
        const color = this.canvasData[key] || "#FFFFFF";
        this.drawPixel(x, y, color);
      }
    }
  }

  /**
   * Draw single pixel
   */
  drawPixel(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

    // Draw grid lines
    this.ctx.strokeStyle = "#e0e0e0";
    this.ctx.lineWidth = 0.5;
    this.ctx.strokeRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
  }

  /**
   * Update pixel data and redraw
   */
  updatePixel(x, y, color) {
    this.canvasData[`${x},${y}`] = color;
    this.drawPixel(x, y, color);
  }

  /**
   * Get pixel coordinates from mouse event
   */
  getPixelCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;

    const x = Math.floor(canvasX / PIXEL_SIZE);
    const y = Math.floor(canvasY / PIXEL_SIZE);

    return { x, y };
  }

  /**
   * Check if coordinates are valid
   */
  isValidCoordinates(x, y) {
    return x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE;
  }
}
