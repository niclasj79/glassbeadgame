
import { useState, useEffect, useRef, useCallback } from 'react';
import { Concept } from '../types';
import { useSessionTimer } from './useSessionTimer';
import { useOptimizedTextGeneration } from './useOptimizedTextGeneration';
import { useOptimizedMovementTracking } from './useOptimizedMovementTracking';

interface PerformantSessionConfig {
  enableBatchedUpdates: boolean;
  enableAggressiveCaching: boolean;
  maxCacheSize: number;
  preloadInsights: boolean;
}

const DEFAULT_CONFIG: PerformantSessionConfig = {
  enableBatchedUpdates: true,
  enableAggressiveCaching: true,
  maxCacheSize: 100,
  preloadInsights: true
};

export const usePerformantSessionManagement = (
  initialConcepts: Concept[],
  onSessionEnd: () => void,
  config: Partial<PerformantSessionConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [concepts, setConcepts] = useState(initialConcepts);
  const [startTime] = useState(Date.now());
  
  // Performance tracking
  const performanceMetrics = useRef({
    renderCount: 0,
    lastRenderTime: 0,
    averageFrameTime: 0,
    cacheHitRate: 0
  });

  // Session management with optimized tracking
  const { sessionTime, remainingTime, isExpired, formatTime } = useSessionTimer(startTime, false);
  
  // Optimized movement tracking with batching and caching
  const { 
    updateConceptMovement, 
    allConceptsStable, 
    cleanup: cleanupMovement,
    flushPendingUpdates 
  } = useOptimizedMovementTracking(sessionId, concepts, {
    batchSize: 10,
    batchTimeout: 100,
    enableLocalCaching: finalConfig.enableAggressiveCaching
  });
  
  // Optimized text generation with preloading
  const { 
    currentInsight, 
    isGenerating, 
    error, 
    generateInsights,
    preloadInsights,
    getCachedInsight 
  } = useOptimizedTextGeneration(sessionId, {
    enablePreloading: finalConfig.preloadInsights,
    maxCacheSize: finalConfig.maxCacheSize
  });

  // Generate session ID and preload data
  useEffect(() => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    
    // Preload insights if enabled
    if (finalConfig.preloadInsights && initialConcepts.length > 0) {
      preloadInsights(initialConcepts);
    }
    
    console.log('Created optimized session:', newSessionId);
  }, [finalConfig.preloadInsights, initialConcepts, preloadInsights]);

  // Update concepts when initial concepts change
  useEffect(() => {
    setConcepts(initialConcepts);
  }, [initialConcepts]);

  // Auto-end session when expired with cleanup
  useEffect(() => {
    if (isExpired) {
      console.log('Session expired, flushing updates and ending...');
      flushPendingUpdates();
      cleanupMovement();
      onSessionEnd();
    }
  }, [isExpired, onSessionEnd, cleanupMovement, flushPendingUpdates]);

  // Optimized insight generation with caching
  useEffect(() => {
    if (allConceptsStable && concepts.length > 0 && sessionId) {
      // Check cache first
      const cachedInsight = getCachedInsight(concepts);
      if (cachedInsight) {
        console.log('Using cached insight');
        performanceMetrics.current.cacheHitRate += 1;
      } else {
        console.log('Generating new insight');
        generateInsights(concepts);
      }
    }
  }, [allConceptsStable, concepts, generateInsights, getCachedInsight, sessionId]);

  // Performance monitoring
  const trackRenderPerformance = useCallback(() => {
    const now = performance.now();
    if (performanceMetrics.current.lastRenderTime > 0) {
      const frameTime = now - performanceMetrics.current.lastRenderTime;
      performanceMetrics.current.averageFrameTime = 
        (performanceMetrics.current.averageFrameTime * 0.9) + (frameTime * 0.1);
    }
    performanceMetrics.current.lastRenderTime = now;
    performanceMetrics.current.renderCount++;
  }, []);

  // Enhanced cleanup with performance flush
  const cleanup = useCallback(() => {
    flushPendingUpdates();
    cleanupMovement();
    
    // Log performance metrics
    console.log('Session Performance Metrics:', {
      renders: performanceMetrics.current.renderCount,
      avgFrameTime: performanceMetrics.current.averageFrameTime.toFixed(2) + 'ms',
      cacheHitRate: performanceMetrics.current.cacheHitRate
    });
  }, [flushPendingUpdates, cleanupMovement]);

  return {
    sessionId,
    concepts,
    setConcepts,
    sessionTime,
    remainingTime,
    isExpired,
    formatTime,
    updateConceptMovement,
    allConceptsStable,
    currentInsight,
    isGenerating,
    error,
    cleanup,
    trackRenderPerformance,
    performanceMetrics: performanceMetrics.current
  };
};
