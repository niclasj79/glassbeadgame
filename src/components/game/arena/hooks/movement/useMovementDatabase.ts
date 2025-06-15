
import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Concept } from '../../types';
import { MovementState, QueuedUpdate, MovementDatabaseHook } from './types';
import { MOVEMENT_CONSTANTS } from './constants';

export const useMovementDatabase = (sessionId: string | null): MovementDatabaseHook => {
  // Optimized queuing system
  const dbUpdateQueueRef = useRef<Map<string, QueuedUpdate>>(new Map());
  const dbUpdateTimeoutRef = useRef<number>();
  const lastDbUpdateRef = useRef<number>(0);
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

  // Optimized database update with better batching
  const debouncedDbUpdate = useCallback(async () => {
    if (!sessionId || dbUpdateQueueRef.current.size === 0) return;

    const now = Date.now();
    
    // Respect minimum interval between DB updates
    if (now - lastDbUpdateRef.current < MOVEMENT_CONSTANTS.DB_UPDATE_MIN_INTERVAL) {
      // Reschedule for later
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current);
      }
      dbUpdateTimeoutRef.current = window.setTimeout(debouncedDbUpdate, MOVEMENT_CONSTANTS.DB_UPDATE_MIN_INTERVAL);
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

  const updateConceptPosition = useCallback((conceptId: string, x: number, y: number, z: number) => {
    if (!sessionId) return;

    const now = Date.now();

    // Queue for database update only if not already queued
    if (!pendingUpdatesRef.current.has(conceptId)) {
      dbUpdateQueueRef.current.set(conceptId, { x, y, z, timestamp: now });
      pendingUpdatesRef.current.add(conceptId);

      // Clear existing timeout and set new one
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current);
      }
      
      dbUpdateTimeoutRef.current = window.setTimeout(debouncedDbUpdate, MOVEMENT_CONSTANTS.DB_UPDATE_DEBOUNCE);
    } else {
      // Just update the queued position
      dbUpdateQueueRef.current.set(conceptId, { x, y, z, timestamp: now });
    }
  }, [sessionId, debouncedDbUpdate]);

  const updateStability = useCallback(async (concepts: Concept[], movementState: MovementState) => {
    if (!sessionId) return;

    try {
      // Batch stability updates with current position data
      const stabilityUpdates = concepts.map(concept => {
        const state = movementState[concept.id];
        return {
          session_id: sessionId,
          concept_id: concept.id,
          is_stable: true,
          position_x: state?.position.x || concept.x,
          position_y: state?.position.y || concept.y,
          position_z: state?.position.z || concept.z,
          updated_at: new Date().toISOString()
        };
      });

      await supabase
        .from('concept_movement_tracking')
        .upsert(stabilityUpdates, {
          onConflict: 'session_id,concept_id'
        });

      console.log('Updated stability for all concepts');
    } catch (error) {
      console.error('Error updating stability in database:', error);
    }
  }, [sessionId]);

  const cleanup = useCallback(() => {
    if (dbUpdateTimeoutRef.current) {
      clearTimeout(dbUpdateTimeoutRef.current);
    }
    
    // Force final database update if there are pending changes
    if (dbUpdateQueueRef.current.size > 0) {
      debouncedDbUpdate();
    }
  }, [debouncedDbUpdate]);

  return {
    updateConceptPosition,
    updateStability,
    cleanup
  };
};
