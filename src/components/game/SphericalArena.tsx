
import React, { useState, useEffect } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SphericalArenaProps } from './arena/types';
import { useOfflineSessionManagement } from './arena/hooks/useOfflineSessionManagement';
import { useConceptInteractions } from './arena/hooks/useConceptInteractions';
import { usePerformanceOptimization } from './arena/hooks/usePerformanceOptimization';
import { useAudio } from '../audio/AudioEngine';
import { AudioControls } from '../audio/AudioControls';
import { EnhancedAudioControls } from '../audio/EnhancedAudioControls';
import { use3DAudioEngine } from '../audio/hooks/use3DAudioEngine';
import { getDisciplineFrequencies } from '../audio/utils/audioUtils';
import { memoryManager } from './arena/utils/memoryManager';
import { useAccessibility } from '../../hooks/useAccessibility';
import { useImprovedTouch } from '../../hooks/useImprovedTouch';
import { LoadingOverlay } from '../ui/loading-overlay';

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
  const [isInitializing, setIsInitializing] = useState(true);
  
  const { 
    preloadAudio, 
    playDisciplineSound, 
    createBackgroundSoundscape, 
    updateDynamicPanning,
    isAudioEnabled,
    initializeAudio
  } = useAudio();

  // Accessibility features
  const { announce, saveFocus, restoreFocus, focusFirst } = useAccessibility({
    announceChanges: true,
    focusManagement: true,
    keyboardNavigation: true
  });

  // Enhanced touch handling
  const { touchState, isTouch } = useImprovedTouch((gesture) => {
    switch (gesture.type) {
      case 'double-tap':
        announce('Double tap detected - focusing on center');
        break;
      case 'pinch':
        if (gesture.scale && gesture.scale > 1.2) {
          announce('Pinch to zoom in detected');
        } else if (gesture.scale && gesture.scale < 0.8) {
          announce('Pinch to zoom out detected');
        }
        break;
      case 'long-press':
        announce('Long press detected - accessing concept details');
        break;
    }
  }, {
    enablePinch: true,
    enableRotation: true,
    longPressDelay: 400
  });

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
      try {
        setIsInitializing(true);
        announce('Initializing audio engine...');
        
        if (preloadAudio && initializeAudio) {
          await preloadAudio();
          await initializeAudio();
          announce('Audio engine ready');
        }
      } catch (error) {
        console.error('Audio initialization failed:', error);
        announce('Audio initialization failed, continuing without audio');
      } finally {
        setIsInitializing(false);
      }
    };
    
    initSessionAudio();
  }, [preloadAudio, initializeAudio, announce]);

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
    maxCacheSize: 50,
    preloadInsights: false
  });

  // Enhanced concept position update handler with accessibility announcements
  const handleConceptPositionUpdate = (conceptId: string, newX: number, newY: number, newZ: number) => {
    console.log(`SphericalArena: Handling concept ${conceptId} position update to:`, { newX, newY, newZ });
    
    // Announce concept movement to screen readers
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      announce(`Moved concept: ${concept.text}`);
    }
    
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
      timeoutId = window.setTimeout(() => {
        createBackgroundSoundscape(concepts, rotationState.x, rotationState.y);
      }, 500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [concepts, isAudioEnabled, createBackgroundSoundscape, rotationState]);

  // Enhanced concept click handler with accessibility and 3D audio
  const enhancedConceptClick = async (conceptId: string) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      // Announce concept selection
      announce(`Selected concept: ${concept.text} from ${concept.discipline}`);
      
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

  // Enhanced concept move handler with accessibility
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
      const throttledUpdate = () => updateDynamicPanning(rotationX, rotationY);
      setTimeout(throttledUpdate, 100);
    }
  };

  // Handle session end with cleanup and accessibility
  const handleSessionEnd = () => {
    const metrics = getPerformanceMetrics();
    console.log('Session ending - Performance metrics:', {
      ...performanceMetrics,
      finalFPS: metrics.averageFPS,
      finalMemory: memoryManager.getCurrentMemoryUsage()
    });
    
    announce('Session ended. Thank you for playing!');
    restoreFocus();
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
        
        optimizeForLowPerformance();
        announce('Performance optimized for better experience');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [getPerformanceMetrics, isOptimal, optimizeForLowPerformance, announce]);

  // Focus management for session start
  useEffect(() => {
    if (!isInitializing) {
      announce(`Session started with ${concepts.length} concepts. ${isTouch ? 'Touch controls active.' : 'Mouse controls active.'}`);
    }
  }, [isInitializing, concepts.length, isTouch, announce]);

  return (
    <div 
      className="min-h-dvh w-full flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black relative overflow-hidden"
      style={{
        height: '100dvh',
        minHeight: '-webkit-fill-available',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
      role="application"
      aria-label="Glass Bead Game - Spherical Arena"
    >
      {/* Header with timer and end session - Fixed height */}
      <div className="flex-shrink-0">
        <SessionHeader
          remainingTime={remainingTime}
          formatTime={formatTime}
          onEndSession={handleSessionEnd}
        />
      </div>

      {/* 3D Canvas - Full remaining screen space */}
      <div className="flex-1 relative min-h-0">
        <LoadingOverlay 
          isLoading={isInitializing} 
          message="Initializing immersive experience..."
          className="bg-gradient-to-br from-indigo-950 via-purple-900 to-black"
        >
          <div className="w-full h-full">
            <CanvasRenderer
              concepts={concepts}
              disciplines={disciplines}
              isPaused={isPaused}
              selectedConcept={selectedConcept}
              onConceptClick={enhancedConceptClick}
              onConceptMove={enhancedConceptMove}
              onRotationChange={handleRotationChange}
            />
          </div>
        </LoadingOverlay>
        
        {/* Bottom UI Elements - Positioned absolutely over the canvas */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <div className="pointer-events-auto">
            <BottomUI
              disciplines={disciplines}
              selectedDisciplines={selectedDisciplines}
              concepts={concepts}
              currentInsight={currentInsight}
              isGenerating={isGenerating}
              error={error}
            />
          </div>
        </div>

        {/* Audio Controls in Arena UI - Fixed position */}
        <div className="absolute bottom-4 right-4 pointer-events-auto">
          <AudioControls />
        </div>
      </div>

      {/* Accessibility Status (Screen reader only) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isTouch ? 'Touch interface active' : 'Mouse interface active'}.
        {concepts.length} concepts available.
        {selectedConcept && `Selected: ${concepts.find(c => c.id === selectedConcept)?.text}`}
      </div>

      {/* Performance Monitor (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-20 left-4 bg-black/80 text-green-400 p-2 rounded text-xs font-mono pointer-events-none">
          <div>Renders: {performanceMetrics.renderCount}</div>
          <div>Avg Frame: {performanceMetrics.averageFrameTime.toFixed(1)}ms</div>
          <div>Audio: {isAudioEnabled ? '3D Ready' : 'Disabled'}</div>
          <div>Concepts: {concepts.length}</div>
          <div>Memory: {memoryManager.getCurrentMemoryUsage().used}</div>
          <div>Status: {isOptimal ? '✅ Optimal' : '⚠️ Degraded'}</div>
          <div>Touch: {isTouch ? '📱 Active' : '🖱️ Mouse'}</div>
          <div>Gesture: {touchState.gestureType}</div>
        </div>
      )}
    </div>
  );
};
