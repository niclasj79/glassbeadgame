
import React, { useState, useEffect } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SphericalArenaProps } from './arena/types';
import { usePerformantSessionManagement } from './arena/hooks/usePerformantSessionManagement';
import { useConceptInteractions } from './arena/hooks/useConceptInteractions';

export const SphericalArena: React.FC<SphericalArenaProps> = ({
  disciplines,
  selectedDisciplines,
  concepts: initialConcepts,
  onConceptInteraction,
  onSessionEnd
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);

  // Optimized session management with performance monitoring
  const {
    sessionId,
    concepts,
    setConcepts,
    remainingTime,
    formatTime,
    updateConceptMovement,
    currentInsight,
    isGenerating,
    error,
    cleanup,
    trackRenderPerformance,
    performanceMetrics
  } = usePerformantSessionManagement(initialConcepts, onSessionEnd, {
    enableBatchedUpdates: true,
    enableAggressiveCaching: true,
    maxCacheSize: 100,
    preloadInsights: true
  });

  // Concept interactions
  const { handleConceptClick, handleConceptMove } = useConceptInteractions(
    concepts,
    disciplines,
    onConceptInteraction
  );

  // Enhanced concept click handler
  const enhancedConceptClick = (conceptId: string) => {
    setSelectedConcept(conceptId);
    handleConceptClick(conceptId);
  };

  // Optimized concept move handler with instant visual feedback
  const enhancedConceptMove = (conceptId: string, newX: number, newY: number, newZ: number) => {
    // Update local state immediately for instant visual feedback
    setConcepts(prev => prev.map(concept => 
      concept.id === conceptId 
        ? { ...concept, x: newX, y: newY, z: newZ }
        : concept
    ));
    
    // Handle business logic
    handleConceptMove(conceptId, newX, newY, newZ);
    
    // Update optimized movement tracking (batched and cached)
    if (sessionId) {
      updateConceptMovement(conceptId, newX, newY, newZ);
    }

    // Track render performance
    trackRenderPerformance();
  };

  // Handle session end with cleanup
  const handleSessionEnd = () => {
    console.log('Session ending - Performance metrics:', performanceMetrics);
    cleanup();
    onSessionEnd();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Performance monitoring effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (performanceMetrics.averageFrameTime > 50) {
        console.warn('Performance degradation detected:', {
          avgFrameTime: performanceMetrics.averageFrameTime.toFixed(2) + 'ms',
          renderCount: performanceMetrics.renderCount
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [performanceMetrics]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black relative overflow-hidden">
      {/* Header with timer and end session */}
      <SessionHeader
        remainingTime={remainingTime}
        formatTime={formatTime}
        onSessionEnd={handleSessionEnd}
      />

      {/* 3D Canvas - Full Screen with Performance Optimization */}
      <div className="flex-1 relative">
        <CanvasRenderer
          concepts={concepts}
          disciplines={disciplines}
          isPaused={isPaused}
          selectedConcept={selectedConcept}
          onConceptClick={enhancedConceptClick}
          onConceptMove={enhancedConceptMove}
        />
        
        {/* Bottom UI Elements */}
        <BottomUI
          disciplines={disciplines}
          selectedDisciplines={selectedDisciplines}
          concepts={concepts}
          currentInsight={currentInsight}
          isGenerating={isGenerating}
          error={error}
        />
      </div>

      {/* Performance Monitor (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-20 left-4 bg-black/80 text-green-400 p-2 rounded text-xs font-mono">
          <div>Renders: {performanceMetrics.renderCount}</div>
          <div>Avg Frame: {performanceMetrics.averageFrameTime.toFixed(1)}ms</div>
          <div>Cache Hits: {performanceMetrics.cacheHitRate}</div>
        </div>
      )}
    </div>
  );
};
