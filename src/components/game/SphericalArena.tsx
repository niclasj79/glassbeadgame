
import React, { useState, useEffect } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SphericalArenaProps } from './arena/types';
import { useOfflineSessionManagement } from './arena/hooks/useOfflineSessionManagement';
import { useConceptInteractions } from './arena/hooks/useConceptInteractions';
import { usePerformanceOptimization } from './arena/hooks/usePerformanceOptimization';
import { useAudio } from '../audio/AudioEngine';
import { EnhancedAudioControls } from '../audio/EnhancedAudioControls';
import { use3DAudioEngine } from '../audio/hooks/use3DAudioEngine';
import { getDisciplineFrequencies } from '../audio/utils/audioUtils';
import { memoryManager } from './arena/utils/memoryManager';

export const SphericalArena: React.FC<SphericalArenaProps> = ({
  disciplines,
  selectedDisciplines,
  concepts: initialConcepts,
  onConceptInteraction,
  onSessionEnd
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [rotationState, setRotationState] = useState({ x: 0, y: 0 });
  const { 
    preloadAudio, 
    playDisciplineSound, 
    createBackgroundSoundscape, 
    updateDynamicPanning,
    isAudioEnabled,
    initializeAudio
  } = useAudio();

  // Performance optimization with adaptive settings
  const { getPerformanceMetrics, optimizeForLowPerformance, isOptimal } = usePerformanceOptimization({
    enableMemoryMonitoring: true,
    enableFrameRateMonitoring: true,
    targetFPS: 60,
    memoryThreshold: 100
  });

  // Automatically initialize audio when session starts
  useEffect(() => {
    const initSessionAudio = async () => {
      if (preloadAudio && initializeAudio) {
        await preloadAudio();
        await initializeAudio();
        console.log('Audio engine initialized and enabled for session');
      }
    };
    
    initSessionAudio();
  }, [preloadAudio, initializeAudio]);

  // Start memory monitoring
  useEffect(() => {
    memoryManager.startMonitoring();
    return () => memoryManager.stopMonitoring();
  }, []);

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
    maxCacheSize: 50, // Reduced for better memory usage
    preloadInsights: false
  });

  // Enhanced concept position update handler with state synchronization
  const handleConceptPositionUpdate = (conceptId: string, newX: number, newY: number, newZ: number) => {
    console.log(`SphericalArena: Handling concept ${conceptId} position update to:`, { newX, newY, newZ });
    
    // Update session state immediately for persistence
    if (sessionId) {
      updateConceptMovement(conceptId, newX, newY, newZ);
    }

    // Update local state with batch update to prevent multiple re-renders
    setConcepts(prev => {
      const updated = prev.map(concept => 
        concept.id === conceptId 
          ? { ...concept, x: newX, y: newY, z: newZ }
          : concept
      );
      console.log(`SphericalArena: Updated local concept state for ${conceptId}`);
      return updated;
    });

    // Track render performance
    trackRenderPerformance();
  };

  // Concept interactions with position update callback
  const { handleConceptClick, handleConceptMove } = useConceptInteractions(
    concepts,
    disciplines,
    onConceptInteraction,
    handleConceptPositionUpdate
  );

  // Create background soundscape when concepts or rotation change (throttled)
  useEffect(() => {
    let timeoutId: number;
    
    if (isAudioEnabled && createBackgroundSoundscape && concepts.length > 0) {
      // Throttle background soundscape updates to every 500ms
      timeoutId = window.setTimeout(() => {
        createBackgroundSoundscape(concepts, rotationState.x, rotationState.y);
      }, 500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [concepts, isAudioEnabled, createBackgroundSoundscape, rotationState]);

  // Enhanced concept click handler with 3D audio
  const enhancedConceptClick = async (conceptId: string) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      const discipline = disciplines.find(d => d.id === concept.discipline);
      if (discipline) {
        // Play sound with 3D positioning
        playDisciplineSound(discipline.id, concept.energy, { 
          x: concept.x, 
          y: concept.y, 
          z: concept.z 
        });
      }
    }
    
    setSelectedConcept(conceptId);
    handleConceptClick(conceptId);
  };

  // Enhanced concept move handler that ensures state flows properly
  const enhancedConceptMove = async (conceptId: string, newX: number, newY: number, newZ: number) => {
    console.log(`SphericalArena: Processing concept move for ${conceptId} to:`, { newX, newY, newZ });
    
    // Call the position update handler which will update both session and local state
    handleConceptPositionUpdate(conceptId, newX, newY, newZ);
    
    // Handle business logic (audio, interactions)
    handleConceptMove(conceptId, newX, newY, newZ);
  };

  // Handle rotation changes for dynamic panning (throttled)
  const handleRotationChange = (rotationX: number, rotationY: number) => {
    setRotationState({ x: rotationX, y: rotationY });
    if (updateDynamicPanning && isAudioEnabled) {
      // Throttle panning updates
      const throttledUpdate = () => updateDynamicPanning(rotationX, rotationY);
      setTimeout(throttledUpdate, 100);
    }
  };

  // Handle session end with cleanup
  const handleSessionEnd = () => {
    const metrics = getPerformanceMetrics();
    console.log('Session ending - Performance metrics:', {
      ...performanceMetrics,
      finalFPS: metrics.averageFPS,
      finalMemory: memoryManager.getCurrentMemoryUsage()
    });
    cleanup();
    onSessionEnd();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Performance monitoring and optimization
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = getPerformanceMetrics();
      
      if (!isOptimal) {
        console.warn('Performance degradation detected:', {
          fps: metrics.averageFPS.toFixed(1),
          memory: memoryManager.getCurrentMemoryUsage(),
          frameTime: metrics.frameTime.toFixed(2) + 'ms'
        });
        
        // Automatically optimize for low performance
        optimizeForLowPerformance();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [getPerformanceMetrics, isOptimal, optimizeForLowPerformance]);

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
          onRotationChange={handleRotationChange}
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

        {/* Audio Controls in Arena UI */}
        <AudioControls className="fixed bottom-4 right-4" />
      </div>

      {/* Performance Monitor (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-20 left-4 bg-black/80 text-green-400 p-2 rounded text-xs font-mono">
          <div>Renders: {performanceMetrics.renderCount}</div>
          <div>Avg Frame: {performanceMetrics.averageFrameTime.toFixed(1)}ms</div>
          <div>Audio: {isAudioEnabled ? '3D Ready' : 'Disabled'}</div>
          <div>Concepts: {concepts.length}</div>
          <div>Memory: {memoryManager.getCurrentMemoryUsage().used}</div>
          <div>Status: {isOptimal ? '✅ Optimal' : '⚠️ Degraded'}</div>
        </div>
      )}
    </div>
  );
};
