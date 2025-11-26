# Frontend Architecture

## Overview

The frontend has been refactored to follow industry best practices with proper separation of concerns, modular architecture, and ES6 module patterns.

## Directory Structure

```
frontend/
├── server.js                 # Node.js static file server
├── package.json
└── public/
    ├── index.html            # Main HTML structure (minimal, semantic)
    ├── css/
    │   └── styles.css        # All styles separated from HTML
    └── js/
        ├── config.js         # Configuration constants
        ├── canvasManager.js  # Canvas rendering logic
        ├── apiService.js     # HTTP API calls
        ├── websocketService.js # WebSocket communication
        ├── uiController.js   # UI updates and interactions
        └── app.js            # Main application orchestration
```

## Architecture Principles

### 1. Separation of Concerns

Each module has a single, well-defined responsibility:

- **config.js**: Application configuration and constants
- **canvasManager.js**: Canvas drawing and pixel management
- **apiService.js**: HTTP API communication
- **websocketService.js**: WebSocket connection and messaging
- **uiController.js**: DOM manipulation and user interactions
- **app.js**: Application orchestration and event coordination

### 2. ES6 Modules

All JavaScript uses ES6 module syntax:

- `export` for exposing functionality
- `import` for consuming dependencies
- Clear dependency tree

### 3. Class-Based Architecture

Services are implemented as classes with clear interfaces:

```javascript
class CanvasManager {
  constructor(canvasElement) {}
  drawCanvas() {}
  drawPixel(x, y, color) {}
  updatePixel(x, y, color) {}
}
```

### 4. Single Responsibility Principle

Each class/module does one thing well:

- `CanvasManager` → Canvas operations only
- `ApiService` → HTTP requests only
- `WebSocketService` → WebSocket communication only
- `UIController` → UI updates only

### 5. Dependency Injection

Dependencies are injected rather than created:

```javascript
constructor(canvasElement) {
  this.canvas = canvasElement; // Injected
}
```

## Module Descriptions

### config.js

- Exports configuration constants
- Single source of truth for app settings
- Environment-aware (uses window.APP_CONFIG)

### canvasManager.js

- Manages canvas rendering
- Handles pixel drawing and updates
- Coordinate system calculations
- No external dependencies except config

### apiService.js

- Static methods for HTTP API calls
- Promise-based async operations
- Error handling with meaningful messages
- RESTful API interactions

### websocketService.js

- WebSocket connection lifecycle
- Event-based message handling
- Automatic reconnection logic
- Type-safe message handlers

### uiController.js

- DOM element management
- Status updates
- Error message handling
- User input processing

### app.js

- Main application entry point
- Coordinates all services
- Event listener setup
- Application initialization

## Benefits

### Maintainability

- Easy to locate and modify specific functionality
- Clear module boundaries
- Reduced coupling between components

### Testability

- Each module can be tested independently
- Mock dependencies easily
- Clear input/output contracts

### Scalability

- Easy to add new features
- Can extend classes without modifying existing code
- Plugin architecture possible

### Readability

- Code organization matches mental model
- Clear file structure
- Self-documenting architecture

### Reusability

- Services can be used in different contexts
- Export/import specific functionality
- No global namespace pollution

## Development Workflow

### Making Changes

1. **Adding a new feature**:
   - Create new module or extend existing class
   - Import required dependencies
   - Export public interface

2. **Modifying existing feature**:
   - Find responsible module
   - Update only that module
   - Other modules unaffected

3. **Debugging**:
   - Check relevant module
   - Clear error messages per module
   - Isolated testing possible

### Code Style

- **Naming**: Descriptive, camelCase for variables/methods, PascalCase for classes
- **Comments**: JSDoc style for public methods
- **Error Handling**: Try-catch with meaningful error messages
- **Async**: Promises with async/await

## Migration Notes

### What Changed

- ✅ Styles moved from `<style>` tag to `css/styles.css`
- ✅ JavaScript split into 6 focused modules
- ✅ Global functions eliminated
- ✅ Event listeners properly scoped
- ✅ Clear dependency hierarchy

### What Stayed the Same

- ✅ All functionality preserved
- ✅ Same API endpoints
- ✅ Same WebSocket protocol
- ✅ Same user experience
- ✅ Backward compatible with backend

## Performance

- **Load time**: Minimal overhead (6 small modules vs 1 large)
- **Caching**: Separate files = better browser caching
- **Memory**: No global variables, proper cleanup
- **Parsing**: ES6 modules parsed once and cached

## Browser Support

Requires modern browsers with ES6 module support:

- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 16+

For older browsers, use a bundler (webpack/rollup) to transpile.

## Future Improvements

Potential enhancements:

- [ ] TypeScript for type safety
- [ ] Unit tests for each module
- [ ] Bundler (webpack) for production builds
- [ ] CSS preprocessor (SASS/LESS)
- [ ] State management (Redux/MobX) if complexity grows
- [ ] Component framework (React/Vue) for larger features
