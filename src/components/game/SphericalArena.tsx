
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
import { Clock, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const isMobile = useIsMobile();
  
  const { playDisciplineSound } = useAudio();

  // Session management hooks
  const { sessionTime, remainingTime, isExpired, formatTime } = useSessionTimer(startTime, false);
  const { updateConceptMovement, allConceptsStable } = useMovementTracking(sessionId, concepts);
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
      onSessionEnd();
    }
  }, [isExpired, onSessionEnd]);

  // Generate insights when all concepts are stable
  useEffect(() => {
    if (allConceptsStable && concepts.length > 0 && sessionId) {
      console.log('All concepts stable for 20 seconds, generating insights...');
      generateInsights(concepts);
    }
  }, [allConceptsStable, concepts, generateInsights, sessionId]);

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
    if (sessionId) {
      updateConceptMovement(conceptId, newX, newY, newZ);
    }
    
    // Play audio feedback for movement
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      playDisciplineSound(concept.discipline, 0.3);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black relative overflow-hidden">
      {/* Header with timer and end session - Made responsive */}
      <div className="absolute top-2 md:top-4 right-2 md:right-4 z-10 flex items-center gap-2 md:gap-4">
        <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-lg backdrop-blur-sm text-xs md:text-sm ${
          remainingTime <= 30 ? 'bg-red-900/80 text-red-200' : 'bg-gray-900/80 text-gray-200'
        }`}>
          <Clock className="h-3 w-3 md:h-4 md:w-4" />
          <span className="font-mono">{formatTime()}</span>
        </div>
        
        {remainingTime <= 30 && (
          <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-lg bg-orange-900/80 text-orange-200">
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
            <span className="text-xs md:text-sm hidden sm:inline">Session ending soon!</span>
            <span className="text-xs md:text-sm sm:hidden">Ending!</span>
          </div>
        )}
        
        <Button
          onClick={onSessionEnd}
          size={isMobile ? "sm" : "default"}
          className="bg-gradient-to-r from-blue-600 to-purple-600 opacity-80 hover:opacity-100 transition-opacity text-xs md:text-sm"
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
        
        {/* Bottom UI Elements - Responsive layout */}
        <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 right-2 md:right-4 flex flex-col md:flex-row justify-between items-end gap-2 md:gap-4">
          {/* Session Info - Hidden on mobile */}
          <div className="hidden md:block">
            <SessionInfo
              disciplines={disciplines}
              selectedDisciplines={selectedDisciplines}
              concepts={concepts}
            />
          </div>
          
          {/* Hesse Insights - Collapsible on mobile */}
          <div className="w-full md:max-w-md md:flex-shrink-0">
            {isMobile ? (
              <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700">
                <button
                  onClick={() => setInsightsExpanded(!insightsExpanded)}
                  className="w-full p-3 flex items-center justify-between text-white"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium">Hesse Insights</span>
                  </div>
                  {insightsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                {insightsExpanded && (
                  <div className="border-t border-gray-700">
                    <HesseInsights
                      conceptualText={currentInsight?.conceptualText || null}
                      dimensionalText={currentInsight?.dimensionalText || null}
                      isGenerating={isGenerating}
                      error={error}
                      className="border-0 bg-transparent"
                    />
                  </div>
                )}
              </div>
            ) : (
              <HesseInsights
                conceptualText={currentInsight?.conceptualText || null}
                dimensionalText={currentInsight?.dimensionalText || null}
                isGenerating={isGenerating}
                error={error}
                className="max-w-md flex-shrink-0"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
