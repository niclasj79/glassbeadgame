
import { useState, useEffect, useRef } from 'react';
import { Concept } from '../types';
import { useMovementTracking } from './useMovementTracking';
import { useTextGeneration } from './useTextGeneration';
import { useSessionTimer } from './useSessionTimer';

export const useSessionManagement = (
  initialConcepts: Concept[],
  onSessionEnd: () => void
) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [concepts, setConcepts] = useState(initialConcepts);
  const [startTime] = useState(Date.now());
  
  // Session management hooks with optimized movement tracking
  const { sessionTime, remainingTime, isExpired, formatTime } = useSessionTimer(startTime, false);
  const { updateConceptMovement, allConceptsStable, cleanup: cleanupMovement } = useMovementTracking(sessionId, concepts);
  const { currentInsight, isGenerating, error, generateInsights } = useTextGeneration(sessionId);

  // Generate session ID on mount
  useEffect(() => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    console.log('Created new session:', newSessionId);
  }, []);

  // Update concepts when initial concepts change
  useEffect(() => {
    setConcepts(initialConcepts);
  }, [initialConcepts]);

  // Auto-end session when expired
  useEffect(() => {
    if (isExpired) {
      console.log('Session expired, ending...');
      cleanupMovement();
      onSessionEnd();
    }
  }, [isExpired, onSessionEnd, cleanupMovement]);

  // Generate insights when all concepts are stable
  useEffect(() => {
    if (allConceptsStable && concepts.length > 0 && sessionId) {
      console.log('All concepts stable for 20 seconds, generating insights...');
      generateInsights(concepts);
    }
  }, [allConceptsStable, concepts, generateInsights, sessionId]);

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
    cleanupMovement
  };
};
