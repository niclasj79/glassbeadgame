
import React, { useState, useEffect } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SphericalArenaProps } from './arena/types';
import { useOfflineSessionManagement } from './arena/hooks/useOfflineSessionManagement';
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

  // Offline session management with performance monitoring
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
  } = useOfflineSessionManagement(initialConcepts, onSessionEnd, {
    enableBatchedUpdates: true,
    enableAggressiveCaching: true,
    maxCacheSize: 100,
    preloadInsights: false // Disabled for offline mode
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
    
    // Update offline movement tracking
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

  // Export session data to JSON
  const exportSessionData = () => {
    if (!sessionId) return;

    try {
      const sessionData = {
        sessionId,
        disciplines: selectedDisciplines,
        concepts,
        insights: currentInsight ? [currentInsight] : [],
        performanceMetrics,
        exportedAt: new Date().toISOString()
      };

      const dataStr = JSON.stringify(sessionData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `glass-bead-game-session-${sessionId.slice(-8)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Session data exported successfully');
    } catch (error) {
      console.error('Failed to export session data:', error);
    }
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
        onEndSession={handleSessionEnd}
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

      {/* Offline Mode Indicator */}
      <div className="absolute top-20 right-4 bg-green-800/80 text-green-200 p-2 rounded text-xs font-mono">
        <div>🌐 OFFLINE MODE</div>
        <button 
          onClick={exportSessionData}
          className="mt-1 text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded"
        >
          Export Session
        </button>
      </div>

      {/* Performance Monitor (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-20 left-4 bg-black/80 text-green-400 p-2 rounded text-xs font-mono">
          <div>Renders: {performanceMetrics.renderCount}</div>
          <div>Avg Frame: {performanceMetrics.averageFrameTime.toFixed(1)}ms</div>
          <div>Mode: Offline</div>
        </div>
      )}
    </div>
  );
};
