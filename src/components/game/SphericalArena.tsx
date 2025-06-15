
import React, { useRef, useEffect, useState } from 'react';
import { useAudio } from '../audio/AudioEngine';
import { ArenaControls } from './arena/ArenaControls';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { ConceptDisplay } from './arena/ConceptDisplay';
import { SessionInfo } from './arena/SessionInfo';
import { SphericalArenaProps, MouseRef, RotationRef } from './arena/types';

export const SphericalArena: React.FC<SphericalArenaProps> = ({
  disciplines,
  selectedDisciplines,
  concepts,
  onConceptInteraction,
  onSessionEnd
}) => {
  const mouseRef = useRef<MouseRef>({ x: 0, y: 0, isDown: false });
  const rotationRef = useRef<RotationRef>({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  
  const { playDisciplineSound } = useAudio();

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPaused) {
        setSessionTime(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const handleConceptClick = (conceptId: string) => {
    setSelectedConcept(conceptId);
    onConceptInteraction(conceptId, 'select');
    
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      const discipline = disciplines.find(d => d.id === concept.discipline);
      if (discipline) {
        playDisciplineSound(concept.discipline, concept.energy);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black">
      {/* Header Controls */}
      <ArenaControls
        sessionTime={sessionTime}
        conceptCount={concepts.length}
        isPaused={isPaused}
        onPauseToggle={() => setIsPaused(!isPaused)}
        onResetRotation={() => {}}
        onSessionEnd={onSessionEnd}
        rotationRef={rotationRef}
      />

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <CanvasRenderer
          concepts={concepts}
          disciplines={disciplines}
          isPaused={isPaused}
          selectedConcept={selectedConcept}
          rotationRef={rotationRef}
          mouseRef={mouseRef}
          onConceptClick={handleConceptClick}
        />
        
        <SessionInfo
          disciplines={disciplines}
          selectedDisciplines={selectedDisciplines}
          concepts={concepts}
        />
        
        <ConceptDisplay
          selectedConcept={selectedConcept}
          concepts={concepts}
        />
      </div>
    </div>
  );
};
