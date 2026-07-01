
import { useRef, useEffect, useCallback } from 'react';
import { Concept } from '../types';
import { useAudio } from '../../../audio/AudioEngine';

export const useConceptInteractions = (
  concepts: Concept[],
  disciplines: any[],
  onConceptInteraction: (conceptId: string, action: string) => void,
  onConceptPositionUpdate?: (conceptId: string, x: number, y: number, z: number) => void
) => {
  const isDraggingRef = useRef(false);
  const { playDisciplineSound } = useAudio();

  // Handle concept click
  const handleConceptClick = useCallback((conceptId: string) => {
    onConceptInteraction(conceptId, 'select');
    
    // Only play audio for clicks, not during dragging
    if (!isDraggingRef.current) {
      const concept = concepts.find(c => c.id === conceptId);
      if (concept) {
        const discipline = disciplines.find(d => d.id === concept.discipline);
        if (discipline) {
          playDisciplineSound(concept.discipline, concept.energy);
        }
      }
    }
  }, [concepts, disciplines, onConceptInteraction, playDisciplineSound]);

  // Handle concept movement with position persistence
  const handleConceptMove = useCallback((conceptId: string, newX: number, newY: number, newZ: number) => {
    console.log(`useConceptInteractions: Handling concept ${conceptId} move to:`, { newX, newY, newZ });
    
    // Handle business logic first
    onConceptInteraction(conceptId, 'move');
    
    // Play movement completion sound
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      const discipline = disciplines.find(d => d.id === concept.discipline);
      if (discipline) {
        playDisciplineSound(concept.discipline, concept.energy * 0.5, { 
          x: newX, 
          y: newY, 
          z: newZ 
        });
      }
    }

    // Note: We don't call onConceptPositionUpdate here as it should be handled 
    // by the caller (SphericalArena.enhancedConceptMove) to maintain proper state flow
  }, [concepts, disciplines, onConceptInteraction, playDisciplineSound]);

  // Track dragging state to prevent audio during drag
  useEffect(() => {
    const handleDragStart = () => { 
      isDraggingRef.current = true; 
      console.log('Concept drag started');
    };
    const handleDragEnd = () => { 
      isDraggingRef.current = false;
      console.log('Concept drag ended');
      
      // Play completion sound when drag ends
      if (concepts.length > 0) {
        const concept = concepts[0];
        if (concept) {
          playDisciplineSound(concept.discipline, 0.3);
        }
      }
    };

    window.addEventListener('conceptdragstart', handleDragStart);
    window.addEventListener('conceptdragend', handleDragEnd);

    return () => {
      window.removeEventListener('conceptdragstart', handleDragStart);
      window.removeEventListener('conceptdragend', handleDragEnd);
    };
  }, [concepts, playDisciplineSound]);

  return {
    handleConceptClick,
    handleConceptMove
  };
};
