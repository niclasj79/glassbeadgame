
import React, { useRef, useEffect, useState } from 'react';
import { useAudio } from '../audio/AudioEngine';
import { CanvasRenderer } from './arena/CanvasRenderer';
import { SessionInfo } from './arena/SessionInfo';
import { HesseInsights } from './arena/HesseInsights';
import { SphericalArenaProps } from './arena/types';
import { useMovementTracking } from './arena/hooks/useMovementTracking';
import { useTextGeneration } from './arena/hooks/useTextGeneration';
import { useSessionTimer } from './arena/hooks/useSessionTimer';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle } from 'lucide-react';

export const SphericalArena: React.FC<SphericalArenaProps> = ({
  disciplines,
  selectedDisciplines,
  concepts: initialConcepts,
  onConceptInteraction,
  onSessionEnd
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [concepts, setConcepts] = useState(initialConcepts);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  
  const { playDisciplineSound } = useAudio();

  // Session management hooks
  const { sessionTime, remainingTime, isExpired, formatTime } = useSessionTimer(startTime, false);
  const { updateConceptMovement, allConceptsStable } = useMovementTracking(sessionId, concepts);
  const { currentInsight, isGenerating, error, generateInsights } = useTextGeneration(sessionId);

  // Generate session ID on mount
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  // Update concepts when initial concepts change
  useEffect(() => {
    setConcepts(initialConcepts);
  }, [initialConcepts]);

  // Auto-end session when expired
  useEffect(() => {
    if (isExpired) {
      onSessionEnd();
    }
  }, [isExpired, onSessionEnd]);

  // Generate insights when all concepts are stable
  useEffect(() => {
    if (allConceptsStable && concepts.length > 0) {
      console.log('All concepts stable, generating insights...');
      generateInsights(concepts);
    }
  }, [allConceptsStable, concepts, generateInsights]);

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
    
    // Update movement tracking
    updateConceptMovement(conceptId, newX, newY, newZ);
    
    // Play audio feedback for movement
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      playDisciplineSound(concept.discipline, 0.3);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black relative">
      {/* Header with timer and end session */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-4">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg backdrop-blur-sm ${
          remainingTime <= 30 ? 'bg-red-900/80 text-red-200' : 'bg-gray-900/80 text-gray-200'
        }`}>
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono">{formatTime()}</span>
        </div>
        
        {remainingTime <= 30 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-900/80 text-orange-200">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Session ending soon!</span>
          </div>
        )}
        
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
        
        {/* Bottom UI Elements */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end gap-4">
          <SessionInfo
            disciplines={disciplines}
            selectedDisciplines={selectedDisciplines}
            concepts={concepts}
          />
          
          <HesseInsights
            conceptualText={currentInsight?.conceptualText || null}
            dimensionalText={currentInsight?.dimensionalText || null}
            isGenerating={isGenerating}
            error={error}
            className="max-w-md flex-shrink-0"
          />
        </div>
      </div>
    </div>
  );
};
