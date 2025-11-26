/**
 * Configuration Module
 * Handles application configuration from environment variables
 */

export const CONFIG = window.APP_CONFIG || {
  WS_URL: "ws://localhost:3002",
  API_URL: "http://localhost:3001",
};

export const CANVAS_SIZE = 50;
export const PIXEL_SIZE = 10; // Canvas is 500x500, so each pixel is 10x10
export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 500;
