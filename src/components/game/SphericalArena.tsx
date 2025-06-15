
import React, { useState, useEffect } from 'react';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionHeader } from './arena/SessionHeader';
import { BottomUI } from './arena/BottomUI';
import { SphericalArenaProps } from './arena/types';
import { useSessionManagement } from './arena/hooks/useSessionManagement';
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

  // Session management
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
    cleanupMovement
  } = useSessionManagement(initialConcepts, onSessionEnd);

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

  // Enhanced concept move handler
  const enhancedConceptMove = (conceptId: string, newX: number, newY: number, newZ: number) => {
    // Update concepts immediately for visual feedback
    setConcepts(prev => prev.map(concept => 
      concept.id === conceptId 
        ? { ...concept, x: newX, y: newY, z: newZ }
        : concept
    ));
    
    handleConceptMove(conceptId, newX, newY, newZ);
    
    // Update movement tracking (now optimized with batching and throttling)
    if (sessionId) {
      updateConceptMovement(conceptId, newX, newY, newZ);
    }
  };

  // Handle session end
  const handleSessionEnd = () => {
    cleanupMovement();
    onSessionEnd();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMovement();
    };
  }, [cleanupMovement]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black relative overflow-hidden">
      {/* Header with timer and end session */}
      <SessionHeader
        remainingTime={remainingTime}
        formatTime={formatTime}
        onEndSession={handleSessionEnd}
      />

      {/* 3D Canvas - Full Screen */}
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
    </div>
  );
};
