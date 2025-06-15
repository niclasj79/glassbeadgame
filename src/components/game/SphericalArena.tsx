
import React, { useRef, useEffect, useState } from 'react';
import { useAudio } from '../audio/AudioEngine';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionInfo } from './arena/SessionInfo';
import { SphericalArenaProps } from './arena/types';
import { Button } from '@/components/ui/button';

export const SphericalArena: React.FC<SphericalArenaProps> = ({
  disciplines,
  selectedDisciplines,
  concepts: initialConcepts,
  onConceptInteraction,
  onSessionEnd
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [concepts, setConcepts] = useState(initialConcepts);
  
  const { playDisciplineSound } = useAudio();

  // Update concepts when initial concepts change
  useEffect(() => {
    setConcepts(initialConcepts);
  }, [initialConcepts]);

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

  const handleConceptMove = (conceptId: string, newX: number, newY: number, newZ: number) => {
    setConcepts(prev => prev.map(concept => 
      concept.id === conceptId 
        ? { ...concept, x: newX, y: newY, z: newZ }
        : concept
    ));
    onConceptInteraction(conceptId, 'move');
    
    // Play audio feedback for movement
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      playDisciplineSound(concept.discipline, 0.3);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black relative">
      {/* Minimal End Session Button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          onClick={onSessionEnd}
          className="bg-gradient-to-r from-blue-600 to-purple-600 opacity-80 hover:opacity-100 transition-opacity"
        >
          End Session
        </Button>
      </div>

      {/* 3D Canvas - Full Screen */}
      <div className="flex-1 relative">
        <CanvasRenderer
          concepts={concepts}
          disciplines={disciplines}
          isPaused={isPaused}
          selectedConcept={selectedConcept}
          onConceptClick={handleConceptClick}
          onConceptMove={handleConceptMove}
        />
        
        <SessionInfo
          disciplines={disciplines}
          selectedDisciplines={selectedDisciplines}
          concepts={concepts}
        />
      </div>
    </div>
  );
};
