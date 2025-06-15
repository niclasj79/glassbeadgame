
import { useState, useCallback, useRef } from 'react';
import { Concept } from '../types';

export const useConceptState = (initialConcepts: Concept[]) => {
  const [concepts, setConcepts] = useState<Concept[]>(initialConcepts);
  const conceptsRef = useRef<Concept[]>(initialConcepts);

  // Update ref whenever state changes
  const updateConceptsRef = useCallback((newConcepts: Concept[]) => {
    conceptsRef.current = newConcepts;
    setConcepts(newConcepts);
  }, []);

  // Update a single concept's position permanently
  const updateConceptPosition = useCallback((conceptId: string, x: number, y: number, z: number) => {
    const newConcepts = conceptsRef.current.map(concept =>
      concept.id === conceptId 
        ? { ...concept, x, y, z }
        : concept
    );
    
    updateConceptsRef(newConcepts);
    console.log(`Concept ${conceptId} permanently moved to:`, { x, y, z });
  }, [updateConceptsRef]);

  // Get current position of a concept
  const getConceptPosition = useCallback((conceptId: string) => {
    const concept = conceptsRef.current.find(c => c.id === conceptId);
    return concept ? { x: concept.x, y: concept.y, z: concept.z } : null;
  }, []);

  // Update concepts from external source (like initial load)
  const updateConcepts = useCallback((newConcepts: Concept[]) => {
    updateConceptsRef(newConcepts);
  }, [updateConceptsRef]);

  return {
    concepts,
    updateConceptPosition,
    getConceptPosition,
    updateConcepts
  };
};
