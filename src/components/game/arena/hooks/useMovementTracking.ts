
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Concept } from '../types';

interface MovementState {
  [conceptId: string]: {
    lastMoved: number;
    isStable: boolean;
    position: { x: number; y: number; z: number };
  };
}

interface QueuedUpdate {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export const useMovementTracking = (sessionId: string | null, concepts: Concept[]) => {
  const [movementState, setMovementState] = useState<MovementState>({});
  const [allConceptsStable, setAllConceptsStable] = useState(false);
  const stabilityCheckRef = useRef<number>();
  
  // Optimized queuing system
  const dbUpdateQueueRef = useRef<Map<string, QueuedUpdate>>(new Map());
  const dbUpdateTimeoutRef = useRef<number>();
  const lastDbUpdateRef = useRef<number>(0);
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

  // Performance constants
  const STABILITY_TIMEOUT = 20000; // 20 seconds
  const DB_UPDATE_DEBOUNCE = 2000; // Increased to 2 seconds for better batching
  const DB_UPDATE_MIN_INTERVAL = 1000; // Minimum 1 second between DB calls
  const STATE_UPDATE_THROTTLE = 32; // ~30fps for state updates (reduced from 60fps)
  const lastStateUpdateRef = useRef<number>(0);

  // Optimized database update with better batching
  const debouncedDbUpdate = useCallback(async () => {
    if (!sessionId || dbUpdateQueueRef.current.size === 0) return;

    const now = Date.now();
    
    // Respect minimum interval between DB updates
    if (now - lastDbUpdateRef.current < DB_UPDATE_MIN_INTERVAL) {
      // Reschedule for later
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current);
      }
      dbUpdateTimeoutRef.current = window.setTimeout(debouncedDbUpdate, DB_UPDATE_MIN_INTERVAL);
      return;
    }

    const updates = Array.from(dbUpdateQueueRef.current.entries());
    dbUpdateQueueRef.current.clear();
    pendingUpdatesRef.current.clear();
    lastDbUpdateRef.current = now;

    try {
      // Batch all updates in a single database call
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

      console.log(`Batched ${updates.length} movement updates to database`);
    } catch (error) {
      console.error('Error updating movement tracking:', error);
      
      // Re-queue failed updates
      updates.forEach(([conceptId, data]) => {
        dbUpdateQueueRef.current.set(conceptId, data);
        pendingUpdatesRef.current.add(conceptId);
      });
    }
  }, [sessionId]);

  // Highly optimized state update with aggressive throttling
  const throttledStateUpdate = useCallback((conceptId: string, x: number, y: number, z: number) => {
    const now = Date.now();
    
    // Aggressive throttling for state updates during drag
    if (now - lastStateUpdateRef.current < STATE_UPDATE_THROTTLE) {
      return;
    }
    
    lastStateUpdateRef.current = now;

    // Update local state with minimal object creation
    setMovementState(prev => {
      // Only update if position actually changed significantly
      const existing = prev[conceptId];
      if (existing && 
          Math.abs(existing.position.x - x) < 1 &&
          Math.abs(existing.position.y - y) < 1 &&
          Math.abs(existing.position.z - z) < 1) {
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

    // Queue for database update only if not already queued
    if (!pendingUpdatesRef.current.has(conceptId)) {
      dbUpdateQueueRef.current.set(conceptId, { x, y, z, timestamp: now });
      pendingUpdatesRef.current.add(conceptId);

      // Clear existing timeout and set new one
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current);
      }
      
      dbUpdateTimeoutRef.current = window.setTimeout(debouncedDbUpdate, DB_UPDATE_DEBOUNCE);
    } else {
      // Just update the queued position
      dbUpdateQueueRef.current.set(conceptId, { x, y, z, timestamp: now });
    }
  }, [debouncedDbUpdate]);

  const updateConceptMovement = useCallback((conceptId: string, x: number, y: number, z: number) => {
    if (!sessionId) return;

    // Immediate throttled state update
    throttledStateUpdate(conceptId, x, y, z);

    // Reset stability timer
    if (stabilityCheckRef.current) {
      clearTimeout(stabilityCheckRef.current);
    }

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

    // Update database for stable concepts (async, non-blocking)
    if (allStable && sessionId) {
      updateStabilityInDatabase();
    }
  }, [movementState, concepts, sessionId]);

  const updateStabilityInDatabase = useCallback(async () => {
    if (!sessionId) return;

    try {
      // Batch stability updates
      const stabilityUpdates = concepts.map(concept => ({
        session_id: sessionId,
        concept_id: concept.id,
        is_stable: true,
        updated_at: new Date().toISOString()
      }));

      await supabase
        .from('concept_movement_tracking')
        .upsert(stabilityUpdates, {
          onConflict: 'session_id,concept_id'
        });

      console.log('Updated stability for all concepts');
    } catch (error) {
      console.error('Error updating stability in database:', error);
    }
  }, [sessionId, concepts]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (stabilityCheckRef.current) {
      clearTimeout(stabilityCheckRef.current);
    }
    if (dbUpdateTimeoutRef.current) {
      clearTimeout(dbUpdateTimeoutRef.current);
    }
    
    // Force final database update if there are pending changes
    if (dbUpdateQueueRef.current.size > 0) {
      debouncedDbUpdate();
    }
  }, [debouncedDbUpdate]);

  return {
    updateConceptMovement,
    allConceptsStable,
    movementState,
    cleanup
  };
};
