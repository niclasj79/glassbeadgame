
import { useState, useRef, useCallback } from 'react';
import { MovementState, MovementStateHook } from './types';
import { MOVEMENT_CONSTANTS } from './constants';

export const useMovementState = (): MovementStateHook => {
  const [movementState, setMovementState] = useState<MovementState>({});
  const lastStateUpdateRef = useRef<number>(0);

  // Highly optimized state update with aggressive throttling
  const updateMovementState = useCallback((conceptId: string, x: number, y: number, z: number) => {
    const now = Date.now();
    
    // Aggressive throttling for state updates during drag
    if (now - lastStateUpdateRef.current < MOVEMENT_CONSTANTS.STATE_UPDATE_THROTTLE) {
      return;
    }
    
    lastStateUpdateRef.current = now;

    // Update local state with minimal object creation
    setMovementState(prev => {
      // Only update if position actually changed significantly
      const existing = prev[conceptId];
      if (existing && 
          Math.abs(existing.position.x - x) < MOVEMENT_CONSTANTS.MIN_POSITION_CHANGE &&
          Math.abs(existing.position.y - y) < MOVEMENT_CONSTANTS.MIN_POSITION_CHANGE &&
          Math.abs(existing.position.z - z) < MOVEMENT_CONSTANTS.MIN_POSITION_CHANGE) {
        return prev; // Skip update if change is minimal
      }

      return {
        ...prev,
        [conceptId]: {
          lastMoved: now,
          isStable: false,
          position: { x, y, z }
        }
      };
    });
  }, []);

  return {
    movementState,
    updateMovementState
  };
};
