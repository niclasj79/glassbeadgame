
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Concept } from '../types';

interface MovementState {
  [conceptId: string]: {
    lastMoved: number;
    isStable: boolean;
    position: { x: number; y: number; z: number };
  };
}

export const useMovementTracking = (sessionId: string | null, concepts: Concept[]) => {
  const [movementState, setMovementState] = useState<MovementState>({});
  const [allConceptsStable, setAllConceptsStable] = useState(false);
  const stabilityCheckRef = useRef<number>();
  const dbUpdateQueueRef = useRef<Map<string, { x: number; y: number; z: number; timestamp: number }>>(new Map());
  const dbUpdateTimeoutRef = useRef<number>();

  const STABILITY_TIMEOUT = 20000; // 20 seconds
  const DB_UPDATE_DEBOUNCE = 1000; // 1 second debounce for DB updates
  const THROTTLE_INTERVAL = 16; // ~60fps throttling for state updates
  const lastUpdateRef = useRef<number>(0);

  // Debounced database update function
  const debouncedDbUpdate = useCallback(async () => {
    if (!sessionId || dbUpdateQueueRef.current.size === 0) return;

    const updates = Array.from(dbUpdateQueueRef.current.entries());
    dbUpdateQueueRef.current.clear();

    try {
      const upsertData = updates.map(([conceptId, data]) => ({
        session_id: sessionId,
        concept_id: conceptId,
        last_moved_at: new Date(data.timestamp).toISOString(),
        is_stable: false,
        position_x: data.x,
        position_y: data.y,
        position_z: data.z,
        updated_at: new Date(data.timestamp).toISOString()
      }));

      await supabase
        .from('concept_movement_tracking')
        .upsert(upsertData, {
          onConflict: 'session_id,concept_id'
        });
    } catch (error) {
      console.error('Error updating movement tracking:', error);
    }
  }, [sessionId]);

  // Throttled state update function
  const throttledStateUpdate = useCallback((conceptId: string, x: number, y: number, z: number) => {
    const now = Date.now();
    
    // Only update if enough time has passed (throttling)
    if (now - lastUpdateRef.current < THROTTLE_INTERVAL) {
      return;
    }
    
    lastUpdateRef.current = now;

    // Update local state immediately for visual feedback
    setMovementState(prev => ({
      ...prev,
      [conceptId]: {
        lastMoved: now,
        isStable: false,
        position: { x, y, z }
      }
    }));

    // Queue for database update
    dbUpdateQueueRef.current.set(conceptId, { x, y, z, timestamp: now });

    // Clear existing timeout and set new one
    if (dbUpdateTimeoutRef.current) {
      clearTimeout(dbUpdateTimeoutRef.current);
    }
    
    dbUpdateTimeoutRef.current = window.setTimeout(debouncedDbUpdate, DB_UPDATE_DEBOUNCE);
  }, [debouncedDbUpdate]);

  const updateConceptMovement = useCallback((conceptId: string, x: number, y: number, z: number) => {
    if (!sessionId) return;

    throttledStateUpdate(conceptId, x, y, z);

    // Clear existing stability check
    if (stabilityCheckRef.current) {
      clearTimeout(stabilityCheckRef.current);
    }

    // Schedule stability check
    stabilityCheckRef.current = window.setTimeout(() => {
      checkStability();
    }, STABILITY_TIMEOUT);
  }, [sessionId, throttledStateUpdate]);

  const checkStability = useCallback(() => {
    const now = Date.now();
    let allStable = true;

    const updatedState = { ...movementState };

    for (const concept of concepts) {
      const state = movementState[concept.id];
      if (state && (now - state.lastMoved >= STABILITY_TIMEOUT)) {
        updatedState[concept.id] = {
          ...state,
          isStable: true
        };
      } else {
        allStable = false;
      }
    }

    setMovementState(updatedState);
    setAllConceptsStable(allStable && concepts.length > 0);

    // Update database for stable concepts
    if (allStable && sessionId) {
      updateStabilityInDatabase();
    }
  }, [movementState, concepts, sessionId]);

  const updateStabilityInDatabase = useCallback(async () => {
    if (!sessionId) return;

    try {
      for (const concept of concepts) {
        await supabase
          .from('concept_movement_tracking')
          .update({ 
            is_stable: true,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', sessionId)
          .eq('concept_id', concept.id);
      }
    } catch (error) {
      console.error('Error updating stability in database:', error);
    }
  }, [sessionId, concepts]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (stabilityCheckRef.current) {
        clearTimeout(stabilityCheckRef.current);
      }
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current);
      }
    };
  }, []);

  return {
    updateConceptMovement,
    allConceptsStable,
    movementState
  };
};
