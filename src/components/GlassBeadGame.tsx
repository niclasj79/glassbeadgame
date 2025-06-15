
import React, { useState } from 'react';
import { AudioProvider } from './audio/AudioEngine';
import { SessionStartFlow } from './game/SessionStartFlow';
import { SphericalArena } from './game/SphericalArena';
import { AIInterpretation } from './game/AIInterpretation';
import { conceptGenerator, Concept } from './game/ConceptGenerator';
import { gameSessionService, GameSessionData } from './game/GameSessionService';
import { useToast } from '@/hooks/use-toast';

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
  const [sessionData, setSessionData] = useState<GameSessionData>({
    disciplines: [],
    concepts: [],
    interactions: [],
    duration: 0,
    sessionType: 'exploration',
    conceptCount: 0
  });
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  const disciplines = [
    { id: 'mathematics', name: 'Mathematics', color: '#3B82F6', icon: '∑' },
    { id: 'music', name: 'Music Theory', color: '#10B981', icon: '♪' },
    { id: 'philosophy', name: 'Philosophy', color: '#8B5CF6', icon: 'Φ' },
    { id: 'physics', name: 'Physics', color: '#F59E0B', icon: 'Ψ' },
    { id: 'art', name: 'Visual Arts', color: '#EF4444', icon: '◊' },
    { id: 'history', name: 'History & Politics', color: '#06B6D4', icon: '⚖' }
  ];

  const handleSessionStart = async (selectedDisciplines: string[], conceptCount: number = 15) => {
    try {
      console.log('Starting session with disciplines:', selectedDisciplines, 'concepts:', conceptCount);
      
      const concepts = await conceptGenerator.generateConcepts(selectedDisciplines, conceptCount);
      console.log('Generated concepts:', concepts);
      
      setCurrentConcepts(concepts);
      setSessionData(prev => ({
        ...prev,
        disciplines: selectedDisciplines,
        concepts,
        sessionType: 'exploration',
        interactions: [],
        conceptCount
      }));
      setStartTime(Date.now());
      setGamePhase('arena');

      toast({
        title: "Session Started",
        description: `Exploring ${conceptCount} concepts across ${selectedDisciplines.length} disciplines`,
      });
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: "Error",
        description: "Failed to start session. Please try again.",
        variant: "destructive"
      });
    }
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

  const handleSessionEnd = async () => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const finalSessionData = {
      ...sessionData,
      duration,
      concepts: currentConcepts
    };
    
    setSessionData(finalSessionData);

    try {
      console.log('Saving session data:', finalSessionData);
      const sessionId = await gameSessionService.createSession(finalSessionData);
      
      if (sessionId) {
        setCurrentSessionId(sessionId);
        toast({
          title: "Session Saved",
          description: "Your exploration has been saved successfully",
        });
      } else {
        toast({
          title: "Warning",
          description: "Session completed but could not be saved to database",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving session:', error);
      toast({
        title: "Warning",
        description: "Session completed but could not be saved",
        variant: "destructive"
      });
    }
    
    setGamePhase('interpretation');
  };

  const handleNewSession = () => {
    setGamePhase('start');
    setSessionData({
      disciplines: [],
      concepts: [],
      interactions: [],
      duration: 0,
      sessionType: 'exploration',
      conceptCount: 0
    });
    setCurrentConcepts([]);
    setCurrentSessionId(null);
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
