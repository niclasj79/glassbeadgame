
import { useState, useCallback, useRef, useEffect } from 'react';
import { Concept } from '../types';

interface MovementCache {
  [conceptId: string]: {
    position: { x: number; y: number; z: number };
    lastMoved: number;
    isStable: boolean;
    pendingUpdate?: boolean;
  };
}

interface OptimizedMovementConfig {
  batchSize: number;
  batchTimeout: number;
  enableLocalCaching: boolean;
  stabilityTimeout?: number;
}

const DEFAULT_CONFIG: OptimizedMovementConfig = {
  batchSize: 10,
  batchTimeout: 100,
  enableLocalCaching: true,
  stabilityTimeout: 20000
};

export const useOptimizedMovementTracking = (
  sessionId: string | null,
  concepts: Concept[],
  config: Partial<OptimizedMovementConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [allConceptsStable, setAllConceptsStable] = useState(false);
  
  // Local movement cache for instant updates
  const movementCache = useRef<MovementCache>({});
  const pendingUpdates = useRef<Set<string>>(new Set());
  const batchTimeout = useRef<number>();
  const stabilityTimeout = useRef<number>();
  
  // Performance counters
  const performanceCounters = useRef({
    cacheHits: 0,
    cacheMisses: 0,
    batchesSent: 0,
    movementsTracked: 0
  });

  // Initialize cache for concepts
  useEffect(() => {
    concepts.forEach(concept => {
      if (!movementCache.current[concept.id]) {
        movementCache.current[concept.id] = {
          position: { x: concept.x, y: concept.y, z: concept.z },
          lastMoved: Date.now(),
          isStable: false
        };
      }
    });
  }, [concepts]);

  // Flush pending updates to prevent data loss
  const flushPendingUpdates = useCallback(async () => {
    if (!sessionId || pendingUpdates.current.size === 0) return;

    const updates = Array.from(pendingUpdates.current).map(conceptId => {
      const cached = movementCache.current[conceptId];
      return {
        conceptId,
        ...cached.position,
        timestamp: cached.lastMoved
      };
    });

    pendingUpdates.current.clear();
    performanceCounters.current.batchesSent++;

    // In a real implementation, this would be a database call
    // For now, we'll just log the batch
    console.log(`Flushed ${updates.length} movement updates (batch #${performanceCounters.current.batchesSent})`);
  }, [sessionId]);

  // Debounced batch update
  const scheduleBatchUpdate = useCallback(() => {
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    batchTimeout.current = window.setTimeout(() => {
      if (pendingUpdates.current.size >= finalConfig.batchSize) {
        flushPendingUpdates();
      }
    }, finalConfig.batchTimeout);
  }, [finalConfig.batchSize, finalConfig.batchTimeout, flushPendingUpdates]);

  // Check stability with optimized caching
  const checkStability = useCallback(() => {
    const now = Date.now();
    let allStable = true;

    for (const concept of concepts) {
      const cached = movementCache.current[concept.id];
      if (cached && (now - cached.lastMoved >= (finalConfig.stabilityTimeout || 20000))) {
        cached.isStable = true;
      } else {
        allStable = false;
      }
    }

    setAllConceptsStable(allStable && concepts.length > 0);
    
    if (allStable) {
      console.log('All concepts stable - ready for insight generation');
    }
  }, [concepts, finalConfig.stabilityTimeout]);

  // Reset stability timer
  const resetStabilityTimer = useCallback(() => {
    if (stabilityTimeout.current) {
      clearTimeout(stabilityTimeout.current);
    }

    stabilityTimeout.current = window.setTimeout(checkStability, finalConfig.stabilityTimeout || 20000);
  }, [checkStability, finalConfig.stabilityTimeout]);

  // Optimized movement update with local caching
  const updateConceptMovement = useCallback((conceptId: string, x: number, y: number, z: number) => {
    if (!sessionId) return;

    const now = Date.now();
    performanceCounters.current.movementsTracked++;

    // Update local cache immediately for instant visual feedback
    movementCache.current[conceptId] = {
      position: { x, y, z },
      lastMoved: now,
      isStable: false,
      pendingUpdate: true
    };

    // Mark for batch update
    pendingUpdates.current.add(conceptId);

    // Schedule batch update if threshold reached
    if (pendingUpdates.current.size >= finalConfig.batchSize) {
      flushPendingUpdates();
    } else {
      scheduleBatchUpdate();
    }

    // Reset stability timer
    resetStabilityTimer();
  }, [sessionId, finalConfig.batchSize, flushPendingUpdates, scheduleBatchUpdate, resetStabilityTimer]);

  // Get cached position for instant feedback
  const getCachedPosition = useCallback((conceptId: string) => {
    const cached = movementCache.current[conceptId];
    if (cached) {
      performanceCounters.current.cacheHits++;
      return cached.position;
    }
    performanceCounters.current.cacheMisses++;
    return null;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    if (stabilityTimeout.current) {
      clearTimeout(stabilityTimeout.current);
    }
    
    // Final flush of any pending updates
    flushPendingUpdates();
    
    // Log performance metrics
    const counters = performanceCounters.current;
    console.log('Movement Tracking Performance:', {
      movements: counters.movementsTracked,
      batches: counters.batchesSent,
      cacheHitRate: ((counters.cacheHits / (counters.cacheHits + counters.cacheMisses)) * 100).toFixed(1) + '%'
    });
  }, [flushPendingUpdates]);

  return {
    updateConceptMovement,
    allConceptsStable,
    movementCache: movementCache.current,
    getCachedPosition,
    flushPendingUpdates,
    cleanup,
    performanceCounters: performanceCounters.current
  };
};
