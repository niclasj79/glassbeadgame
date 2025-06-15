
import { useState, useRef, useEffect } from 'react';
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

  const STABILITY_TIMEOUT = 20000; // 20 seconds

  const updateConceptMovement = async (conceptId: string, x: number, y: number, z: number) => {
    if (!sessionId) return;

    const now = Date.now();
    
    // Update local state
    setMovementState(prev => ({
      ...prev,
      [conceptId]: {
        lastMoved: now,
        isStable: false,
        position: { x, y, z }
      }
    }));

    // Update database tracking
    try {
      await supabase
        .from('concept_movement_tracking')
        .upsert({
          session_id: sessionId,
          concept_id: conceptId,
          last_moved_at: new Date(now).toISOString(),
          is_stable: false,
          position_x: x,
          position_y: y,
          position_z: z,
          updated_at: new Date(now).toISOString()
        }, {
          onConflict: 'session_id,concept_id'
        });
    } catch (error) {
      console.error('Error updating movement tracking:', error);
    }

    // Clear existing stability check
    if (stabilityCheckRef.current) {
      clearTimeout(stabilityCheckRef.current);
    }

    // Schedule stability check
    stabilityCheckRef.current = window.setTimeout(() => {
      checkStability();
    }, STABILITY_TIMEOUT);
  };

  const checkStability = () => {
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
  };

  const updateStabilityInDatabase = async () => {
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
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (stabilityCheckRef.current) {
        clearTimeout(stabilityCheckRef.current);
      }
    };
  }, []);

  return {
    updateConceptMovement,
    allConceptsStable,
    movementState
  };
};
