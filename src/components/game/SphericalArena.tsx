
import React, { useState, useEffect } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SphericalArenaProps } from './arena/types';
import { useOfflineSessionManagement } from './arena/hooks/useOfflineSessionManagement';
import { useConceptInteractions } from './arena/hooks/useConceptInteractions';
import { useAudio } from '../audio/AudioEngine';
import { AudioControls } from '../audio/AudioControls';

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

  // Automatically initialize audio when session starts
  useEffect(() => {
    const initSessionAudio = async () => {
      if (preloadAudio && initializeAudio) {
        await preloadAudio();
        await initializeAudio(); // Automatically enable audio
        console.log('Audio engine initialized and enabled for session');
      }
    };
    
    initSessionAudio();
  }, [preloadAudio, initializeAudio]);

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
    preloadInsights: false
  });

  // Enhanced concept position update handler
  const handleConceptPositionUpdate = (conceptId: string, newX: number, newY: number, newZ: number) => {
    console.log(`Updating concept ${conceptId} position in SphericalArena:`, { newX, newY, newZ });
    
    // Update local state immediately for instant visual feedback
    setConcepts(prev => prev.map(concept => 
      concept.id === conceptId 
        ? { ...concept, x: newX, y: newY, z: newZ }
        : concept
    ));
    
    // Update offline movement tracking
    if (sessionId) {
      updateConceptMovement(conceptId, newX, newY, newZ);
    }

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

  // Create background soundscape when concepts or rotation change
  useEffect(() => {
    if (isAudioEnabled && createBackgroundSoundscape && concepts.length > 0) {
      createBackgroundSoundscape(concepts, rotationState.x, rotationState.y);
    }
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

  // Enhanced concept move handler with proper position persistence
  const enhancedConceptMove = async (conceptId: string, newX: number, newY: number, newZ: number) => {
    console.log(`SphericalArena handling concept move for ${conceptId}:`, { newX, newY, newZ });
    
    // Handle the move through the concept interactions (this will trigger position update)
    handleConceptMove(conceptId, newX, newY, newZ);
  };

  // Handle rotation changes for dynamic panning
  const handleRotationChange = (rotationX: number, rotationY: number) => {
    setRotationState({ x: rotationX, y: rotationY });
    if (updateDynamicPanning && isAudioEnabled) {
      updateDynamicPanning(rotationX, rotationY);
    }
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
        </div>
      )}
    </div>
  );
};
