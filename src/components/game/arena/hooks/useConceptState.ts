
import React, { useState, useCallback, useRef } from 'react';
import { Concept } from '../types';
import { memoryManager } from '../utils/memoryManager';

export const useConceptState = (initialConcepts: Concept[]) => {
  const [concepts, setConcepts] = useState<Concept[]>(initialConcepts);
  const conceptsRef = useRef<Concept[]>(initialConcepts);
  const updateBatch = useRef<Map<string, { x: number; y: number; z: number; timestamp: number }>>(new Map());
  const batchTimeout = useRef<number>();

  // Update ref whenever state changes
  const updateConceptsRef = useCallback((newConcepts: Concept[]) => {
    conceptsRef.current = newConcepts;
    setConcepts(newConcepts);
  }, []);

  // Batched position updates for better performance
  const flushBatch = useCallback(() => {
    if (updateBatch.current.size === 0) return;

    const newConcepts = conceptsRef.current.map(concept => {
      const update = updateBatch.current.get(concept.id);
      if (update) {
        return { ...concept, x: update.x, y: update.y, z: update.z };
      }
      return concept;
    });
    
    updateConceptsRef(newConcepts);
    updateBatch.current.clear();
    console.log(`useConceptState: Flushed batch update for ${updateBatch.current.size} concepts`);
  }, [updateConceptsRef]);

  // Update a single concept's position with batching
  const updateConceptPosition = useCallback((conceptId: string, x: number, y: number, z: number) => {
    console.log(`useConceptState: Batching position update for concept ${conceptId}:`, { x, y, z });
    
    // Add to batch
    updateBatch.current.set(conceptId, { x, y, z, timestamp: Date.now() });

    // Clear existing timeout and set new one
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    // Batch updates every 16ms (~60fps)
    batchTimeout.current = window.setTimeout(flushBatch, 16);
  }, [flushBatch]);

  // Get current position of a concept
  const getConceptPosition = useCallback((conceptId: string) => {
    // Check batch first for most recent position
    const batched = updateBatch.current.get(conceptId);
    if (batched) {
      return { x: batched.x, y: batched.y, z: batched.z };
    }

    const concept = conceptsRef.current.find(c => c.id === conceptId);
    return concept ? { x: concept.x, y: concept.y, z: concept.z } : null;
  }, []);

  // Update concepts from external source
  const updateConcepts = useCallback((newConcepts: Concept[]) => {
    console.log(`useConceptState: Updating all concepts. Count: ${newConcepts.length}`);
    
    // Clear any pending batch updates
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    updateBatch.current.clear();
    
    updateConceptsRef(newConcepts);
  }, [updateConceptsRef]);

  // Get all current concepts
  const getCurrentConcepts = useCallback(() => {
    return conceptsRef.current;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    flushBatch(); // Ensure all updates are applied
    updateBatch.current.clear();
  }, [flushBatch]);

  // Register cleanup with memory manager
  React.useEffect(() => {
    memoryManager.registerCleanupTask(cleanup);
    return () => {
      memoryManager.unregisterCleanupTask(cleanup);
      cleanup();
    };
  }, [cleanup]);

  return {
    concepts,
    updateConceptPosition,
    getConceptPosition,
    updateConcepts,
    getCurrentConcepts,
    cleanup
  };
};
