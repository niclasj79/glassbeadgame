
import { useState, useCallback } from 'react';
import { Concept } from '../types';
import { useMovementDatabase } from './movement/useMovementDatabase';
import { useMovementState } from './movement/useMovementState';
import { useMovementTimers } from './movement/useMovementTimers';
import { MovementState } from './movement/types';

export const useMovementTracking = (sessionId: string | null, concepts: Concept[]) => {
  const [allConceptsStable, setAllConceptsStable] = useState(false);
  
  // Initialize specialized hooks
  const { movementState, updateMovementState } = useMovementState();
  const { updateConceptPosition, updateStability, cleanup: cleanupDatabase } = useMovementDatabase(sessionId);
  
  // Handle stability check results
  const handleStabilityCheck = useCallback((allStable: boolean, updatedState: MovementState) => {
    // Update movement state with stability changes
    Object.keys(updatedState).forEach(conceptId => {
      const state = updatedState[conceptId];
      if (state.isStable !== movementState[conceptId]?.isStable) {
        updateMovementState(conceptId, state.position.x, state.position.y, state.position.z);
      }
    });

    setAllConceptsStable(allStable);

    // Update database for stable concepts (async, non-blocking)
    if (allStable && sessionId) {
      updateStability(concepts, updatedState);
    }
  }, [concepts, sessionId, updateStability, updateMovementState, movementState]);

  const { resetStabilityTimer, cleanup: cleanupTimers } = useMovementTimers(
    concepts,
    movementState,
    handleStabilityCheck
  );

  // Main function to update concept movement
  const updateConceptMovement = useCallback((conceptId: string, x: number, y: number, z: number) => {
    if (!sessionId) return;

    // Update local state immediately for visual feedback
    updateMovementState(conceptId, x, y, z);

    // Queue database update
    updateConceptPosition(conceptId, x, y, z);

    // Reset stability timer
    resetStabilityTimer();
  }, [sessionId, updateMovementState, updateConceptPosition, resetStabilityTimer]);

  // Cleanup function
  const cleanup = useCallback(() => {
    cleanupTimers();
    cleanupDatabase();
  }, [cleanupTimers, cleanupDatabase]);

  return {
    updateConceptMovement,
    allConceptsStable,
    movementState,
    cleanup
  };
};
