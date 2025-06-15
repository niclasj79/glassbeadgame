import { useState, useCallback, useRef, useMemo } from 'react';
import { Concept } from '../types';
import { memoryManager } from '../utils/memoryManager';

interface ConceptUpdateBatch {
  conceptId: string;
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export const useOptimizedConceptState = (initialConcepts: Concept[]) => {
  const [concepts, setConcepts] = useState<Concept[]>(initialConcepts);
  const conceptsRef = useRef<Concept[]>(initialConcepts);
  const updateBatch = useRef<ConceptUpdateBatch[]>([]);
  const batchTimeout = useRef<number>();
  const positionCache = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());

  // Memoized concept lookup for O(1) access
  const conceptMap = useMemo(() => {
    const map = new Map<string, Concept>();
    concepts.forEach(concept => map.set(concept.id, concept));
    return map;
  }, [concepts]);

  // Batch position updates for better performance
  const flushUpdateBatch = useCallback(() => {
    if (updateBatch.current.length === 0) return;

    const updates = new Map<string, ConceptUpdateBatch>();
    
    // Keep only the latest update for each concept
    updateBatch.current.forEach(update => {
      updates.set(update.conceptId, update);
    });

    // Apply batched updates
    conceptsRef.current = conceptsRef.current.map(concept => {
      const update = updates.get(concept.id);
      if (update) {
        const updatedConcept = { ...concept, x: update.x, y: update.y, z: update.z };
        positionCache.current.set(concept.id, { x: update.x, y: update.y, z: update.z });
        return updatedConcept;
      }
      return concept;
    });

    setConcepts([...conceptsRef.current]);
    updateBatch.current = [];
  }, []);

  // Optimized position update with batching
  const updateConceptPosition = useCallback((conceptId: string, x: number, y: number, z: number) => {
    // Add to batch
    updateBatch.current.push({ conceptId, x, y, z, timestamp: Date.now() });

    // Update cache immediately for instant feedback
    positionCache.current.set(conceptId, { x, y, z });

    // Clear existing timeout and set new one
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    // Batch updates for better performance
    batchTimeout.current = window.setTimeout(flushUpdateBatch, 16); // ~60fps
  }, [flushUpdateBatch]);

  // Fast position lookup from cache
  const getConceptPosition = useCallback((conceptId: string) => {
    // Try cache first for instant access
    const cached = positionCache.current.get(conceptId);
    if (cached) return cached;

    // Fallback to concept lookup
    const concept = conceptMap.get(conceptId);
    return concept ? { x: concept.x, y: concept.y, z: concept.z } : null;
  }, [conceptMap]);

  // Optimized bulk update
  const updateConcepts = useCallback((newConcepts: Concept[]) => {
    conceptsRef.current = newConcepts;
    setConcepts(newConcepts);
    
    // Update position cache
    newConcepts.forEach(concept => {
      positionCache.current.set(concept.id, { x: concept.x, y: concept.y, z: concept.z });
    });
  }, []);

  // Get current concepts with ref for consistency
  const getCurrentConcepts = useCallback(() => {
    return conceptsRef.current;
  }, []);

  // Memory cleanup
  const cleanup = useCallback(() => {
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    flushUpdateBatch(); // Ensure all updates are applied
    positionCache.current.clear();
  }, [flushUpdateBatch]);

  // Register cleanup with memory manager
  useMemo(() => {
    memoryManager.registerCleanupTask(cleanup);
    return () => memoryManager.unregisterCleanupTask(cleanup);
  }, [cleanup]);

  return {
    concepts,
    updateConceptPosition,
    getConceptPosition,
    updateConcepts,
    getCurrentConcepts,
    cleanup,
    // Performance utilities
    getConceptById: (id: string) => conceptMap.get(id),
    getCachedPosition: (id: string) => positionCache.current.get(id)
  };
};
