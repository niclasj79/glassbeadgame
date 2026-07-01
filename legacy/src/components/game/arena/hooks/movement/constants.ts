
// Performance and timing constants for movement tracking
export const MOVEMENT_CONSTANTS = {
  // Stability detection
  STABILITY_TIMEOUT: 20000, // 20 seconds

  // Database update optimization
  DB_UPDATE_DEBOUNCE: 2000, // 2 seconds for better batching
  DB_UPDATE_MIN_INTERVAL: 1000, // Minimum 1 second between DB calls

  // State update performance
  STATE_UPDATE_THROTTLE: 32, // ~30fps for state updates
  
  // Position change detection
  MIN_POSITION_CHANGE: 1, // Minimum change to trigger update
} as const;
