import React, { useState } from 'react';
import { AudioProvider } from './audio/AudioEngine';
import { SessionStartFlow } from './game/SessionStartFlow';
import { SphericalArena } from './game/SphericalArena';
import { AIInterpretation } from './game/AIInterpretation';
import { conceptGenerator, Concept } from './game/ConceptGenerator';

export interface GameState {
  activePlayer: string;
  selectedDisciplines: string[];
  currentSynthesis: any;
  collaborators: Player[];
  explorationDepth: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  activeNodes: string[];
}

export const GlassBeadGame: React.FC = () => {
  const [gamePhase, setGamePhase] = useState<'start' | 'arena' | 'interpretation'>('start');
  const [sessionData, setSessionData] = useState({
    disciplines: [],
    concepts: [],
    interactions: [],
    duration: 0,
    sessionType: 'exploration'
  });
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [startTime, setStartTime] = useState<number>(0);

  const disciplines = [
    { id: 'mathematics', name: 'Mathematics', color: '#3B82F6', icon: '∑' },
    { id: 'music', name: 'Music Theory', color: '#10B981', icon: '♪' },
    { id: 'philosophy', name: 'Philosophy', color: '#8B5CF6', icon: 'Φ' },
    { id: 'physics', name: 'Physics', color: '#F59E0B', icon: 'Ψ' },
    { id: 'art', name: 'Visual Arts', color: '#EF4444', icon: '◊' },
    { id: 'history', name: 'History & Politics', color: '#06B6D4', icon: '⚖' }
  ];

  const handleSessionStart = (selectedDisciplines: string[], sessionType: string) => {
    const concepts = conceptGenerator.generateConcepts(selectedDisciplines, 15);
    setCurrentConcepts(concepts);
    setSessionData(prev => ({
      ...prev,
      disciplines: selectedDisciplines,
      concepts,
      sessionType,
      interactions: []
    }));
    setStartTime(Date.now());
    setGamePhase('arena');
  };

  const handleConceptInteraction = (conceptId: string, action: string) => {
    const interaction = {
      conceptId,
      action,
      timestamp: Date.now() - startTime
    };
    
    setSessionData(prev => ({
      ...prev,
      interactions: [...prev.interactions, interaction]
    }));

    // Update concept energy based on interaction
    setCurrentConcepts(prev => prev.map(concept => 
      concept.id === conceptId 
        ? { ...concept, energy: Math.min(1, concept.energy + 0.1) }
        : concept
    ));
  };

  const handleSessionEnd = () => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    setSessionData(prev => ({
      ...prev,
      duration
    }));
    setGamePhase('interpretation');
  };

  const handleNewSession = () => {
    setGamePhase('start');
    setSessionData({
      disciplines: [],
      concepts: [],
      interactions: [],
      duration: 0,
      sessionType: 'exploration'
    });
    setCurrentConcepts([]);
  };

  const handleBackToMenu = () => {
    setGamePhase('start');
  };

  return (
    <AudioProvider>
      <div className="min-h-screen">
        {gamePhase === 'start' && (
          <SessionStartFlow
            disciplines={disciplines}
            onSessionStart={handleSessionStart}
          />
        )}
        
        {gamePhase === 'arena' && (
          <SphericalArena
            disciplines={disciplines}
            selectedDisciplines={sessionData.disciplines}
            concepts={currentConcepts}
            onConceptInteraction={handleConceptInteraction}
            onSessionEnd={handleSessionEnd}
          />
        )}
        
        {gamePhase === 'interpretation' && (
          <AIInterpretation
            sessionData={sessionData}
            onNewSession={handleNewSession}
            onBackToMenu={handleBackToMenu}
          />
        )}
      </div>
    </AudioProvider>
  );
};
