
import { useRef, useCallback, useState } from 'react';
import { Concept } from '../../types';
import { MovementState, MovementTimersHook } from './types';
import { MOVEMENT_CONSTANTS } from './constants';

export const useMovementTimers = (
  concepts: Concept[],
  movementState: MovementState,
  onStabilityCheck: (allStable: boolean, updatedState: MovementState) => void
): MovementTimersHook => {
  const stabilityCheckRef = useRef<number>();

  const checkStability = useCallback(() => {
    const now = Date.now();
    let allStable = true;
    const updatedState = { ...movementState };

    for (const concept of concepts) {
      const state = movementState[concept.id];
      if (state && (now - state.lastMoved >= MOVEMENT_CONSTANTS.STABILITY_TIMEOUT)) {
        updatedState[concept.id] = {
          ...state,
          isStable: true
        };
      } else {
        allStable = false;
      }
    }

    onStabilityCheck(allStable && concepts.length > 0, updatedState);
  }, [movementState, concepts, onStabilityCheck]);

  const resetStabilityTimer = useCallback(() => {
    if (stabilityCheckRef.current) {
      clearTimeout(stabilityCheckRef.current);
    }

    stabilityCheckRef.current = window.setTimeout(() => {
      checkStability();
    }, MOVEMENT_CONSTANTS.STABILITY_TIMEOUT);
  }, [checkStability]);

  const cleanup = useCallback(() => {
    if (stabilityCheckRef.current) {
      clearTimeout(stabilityCheckRef.current);
    }
  }, []);

  return {
    resetStabilityTimer,
    checkStability,
    cleanup
  };
};
