
import { useRef, useEffect, useCallback } from 'react';
import { Concept } from '../types';
import { useAudio } from '../../../audio/AudioEngine';

export const useConceptInteractions = (
  concepts: Concept[],
  disciplines: any[],
  onConceptInteraction: (conceptId: string, action: string) => void
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

  // Handle concept movement
  const handleConceptMove = useCallback((conceptId: string, newX: number, newY: number, newZ: number) => {
    onConceptInteraction(conceptId, 'move');
  }, [onConceptInteraction]);

  // Track dragging state to prevent audio during drag
  useEffect(() => {
    const handleDragStart = () => { isDraggingRef.current = true; };
    const handleDragEnd = () => { 
      isDraggingRef.current = false;
      // Play a single audio feedback when drag ends
      if (concepts.length > 0) {
        const concept = concepts[0]; // Use first concept as fallback
        if (concept) {
          playDisciplineSound(concept.discipline, 0.2);
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
