
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

  // Update a single concept's position permanently with enhanced logging
  const updateConceptPosition = useCallback((conceptId: string, x: number, y: number, z: number) => {
    console.log(`useConceptState: Updating concept ${conceptId} position to:`, { x, y, z });
    
    const newConcepts = conceptsRef.current.map(concept =>
      concept.id === conceptId 
        ? { ...concept, x, y, z }
        : concept
    );
    
    updateConceptsRef(newConcepts);
    console.log(`useConceptState: Concept ${conceptId} position updated successfully`);
  }, [updateConceptsRef]);

  // Get current position of a concept
  const getConceptPosition = useCallback((conceptId: string) => {
    const concept = conceptsRef.current.find(c => c.id === conceptId);
    return concept ? { x: concept.x, y: concept.y, z: concept.z } : null;
  }, []);

  // Update concepts from external source (like initial load) with change detection
  const updateConcepts = useCallback((newConcepts: Concept[]) => {
    console.log(`useConceptState: Updating all concepts. Count: ${newConcepts.length}`);
    updateConceptsRef(newConcepts);
  }, [updateConceptsRef]);

  // Get all current concepts
  const getCurrentConcepts = useCallback(() => {
    return conceptsRef.current;
  }, []);

  return {
    concepts,
    updateConceptPosition,
    getConceptPosition,
    updateConcepts,
    getCurrentConcepts
  };
};
