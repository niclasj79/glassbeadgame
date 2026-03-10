
import { useState, useEffect, useRef, useCallback } from 'react';
import { Concept } from '../types';
import { useSessionTimer } from './useSessionTimer';
import { useOfflineTextGeneration } from './useOfflineTextGeneration';
import { useOfflineMovementTracking } from './useOfflineMovementTracking';
import { isFeatureEnabled } from '@/config/featureFlags';

interface OfflineSessionConfig {
  enableBatchedUpdates: boolean;
  enableAggressiveCaching: boolean;
  maxCacheSize: number;
  preloadInsights: boolean;
}

const DEFAULT_CONFIG: OfflineSessionConfig = {
  enableBatchedUpdates: true,
  enableAggressiveCaching: true,
  maxCacheSize: 100,
  preloadInsights: false // Disabled for offline mode
};

// Helper function to format time in mm:ss format
const formatTimeValue = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const useOfflineSessionManagement = (
  initialConcepts: Concept[],
  onSessionEnd: () => void,
  config: Partial<OfflineSessionConfig> = {}
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

  // Offline session management
  const { sessionTime, remainingTime, isExpired, maxDuration, formatTime } = useSessionTimer(startTime, false);
  
  // Offline movement tracking
  const { 
    updateConceptMovement, 
    allConceptsStable, 
    cleanup: cleanupMovement,
    flushPendingUpdates 
  } = useOfflineMovementTracking(sessionId, concepts, {
    batchSize: 10,
    batchTimeout: 100,
    enableLocalCaching: finalConfig.enableAggressiveCaching
  });
  
  // Offline text generation - only initialize if Hesse insights are enabled
  const textGeneration = useOfflineTextGeneration(
    isFeatureEnabled('hesseInsights') ? sessionId : null, 
    { cooldownPeriod: 15000 }
  );

  const { 
    currentInsight, 
    isGenerating, 
    error, 
    generateInsights,
    preloadInsights,
    getCachedInsight 
  } = textGeneration;

  // Generate session ID
  useEffect(() => {
    const newSessionId = `offline-${crypto.randomUUID()}`;
    setSessionId(newSessionId);
    
    console.log('Created offline session:', newSessionId);
    
    // Save session to localStorage
    const sessionData = {
      id: newSessionId,
      startTime,
      concepts: initialConcepts,
      createdAt: new Date().toISOString()
    };
    
    try {
      localStorage.setItem(`session-${newSessionId}`, JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to save session to localStorage:', error);
    }
  }, [startTime, initialConcepts]);

  // Update concepts when initial concepts change
  useEffect(() => {
    setConcepts(initialConcepts);
  }, [initialConcepts]);

  // Auto-end session when expired
  useEffect(() => {
    if (isExpired) {
      console.log('Session expired, ending offline session...');
      flushPendingUpdates();
      cleanupMovement();
      onSessionEnd();
    }
  }, [isExpired, onSessionEnd, cleanupMovement, flushPendingUpdates]);

  // Generate insights when concepts are stable - only if Hesse insights are enabled
  useEffect(() => {
    if (isFeatureEnabled('hesseInsights') && allConceptsStable && concepts.length > 0 && sessionId) {
      console.log('Generating offline insight for stable concepts');
      generateInsights(concepts);
    }
  }, [allConceptsStable, concepts, generateInsights, sessionId]);

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

  // Enhanced cleanup
  const cleanup = useCallback(() => {
    flushPendingUpdates();
    cleanupMovement();
    
    // Save final session state to localStorage
    if (sessionId) {
      try {
        const finalSessionData = {
          id: sessionId,
          startTime,
          endTime: Date.now(),
          duration: sessionTime,
          concepts,
          completedAt: new Date().toISOString(),
          performanceMetrics: performanceMetrics.current
        };
        localStorage.setItem(`session-${sessionId}-final`, JSON.stringify(finalSessionData));
      } catch (error) {
        console.warn('Failed to save final session state:', error);
      }
    }
    
    console.log('Offline Session Performance Metrics:', {
      renders: performanceMetrics.current.renderCount,
      avgFrameTime: performanceMetrics.current.averageFrameTime.toFixed(2) + 'ms',
      sessionDuration: formatTimeValue(sessionTime)
    });
  }, [flushPendingUpdates, cleanupMovement, sessionId, startTime, sessionTime, concepts]);

  return {
    sessionId,
    concepts,
    setConcepts,
    sessionTime,
    remainingTime,
    isExpired,
    maxDuration,
    formatTime,
    updateConceptMovement,
    allConceptsStable,
    currentInsight: isFeatureEnabled('hesseInsights') ? currentInsight : null,
    isGenerating: isFeatureEnabled('hesseInsights') ? isGenerating : false,
    error: isFeatureEnabled('hesseInsights') ? error : null,
    cleanup,
    trackRenderPerformance,
    performanceMetrics: performanceMetrics.current
  };
};
