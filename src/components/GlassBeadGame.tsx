
import React, { useState } from 'react';
import { AudioProvider } from './audio/AudioEngine';
import { SessionStartFlow } from './game/SessionStartFlow';
import { SphericalArena } from './game/SphericalArena';
import { AIInterpretation } from './game/AIInterpretation';
import { conceptGenerator, Concept } from './game/ConceptGenerator';
import { gameSessionService, GameSessionData } from './game/GameSessionService';
import { GameErrorBoundary } from './error/GameErrorBoundary';
import { ErrorBoundary } from './error/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import { useStateRecovery } from '@/hooks/useStateRecovery';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';

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

interface GameSessionState {
  phase: 'start' | 'arena' | 'interpretation';
  sessionData: GameSessionData;
  currentConcepts: Concept[];
  startTime: number;
  currentSessionId: string | null;
}

const initialGameState: GameSessionState = {
  phase: 'start',
  sessionData: {
    disciplines: [],
    concepts: [],
    interactions: [],
    duration: 0,
    sessionType: 'exploration',
    conceptCount: 0
  },
  currentConcepts: [],
  startTime: 0,
  currentSessionId: null
};

export const GlassBeadGame: React.FC = () => {
  const { toast } = useToast();
  
  // Use state recovery for robust game state management
  const {
    state: gameState,
    updateState: updateGameState,
    restoreFromSnapshot,
    hasSnapshots,
    emergencyReset
  } = useStateRecovery(initialGameState, {
    persistKey: 'glass-bead-game-state',
    snapshotInterval: 30000, // Snapshot every 30 seconds
    enablePersistence: true
  });

  // Error recovery for handling game errors
  const { handleError, retry, reset: resetErrors } = useErrorRecovery({
    maxRetries: 3,
    retryDelay: 2000,
    onError: (error) => {
      toast({
        title: "Game Error",
        description: "An error occurred during gameplay. The game will attempt to recover.",
        variant: "destructive"
      });
    },
    onRecovery: () => {
      toast({
        title: "Recovery Successful",
        description: "The game has recovered from the error.",
      });
    }
  });

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
      
      const sessionId = crypto.randomUUID();
      
      updateGameState(prev => ({
        ...prev,
        phase: 'arena',
        currentConcepts: concepts,
        currentSessionId: sessionId,
        startTime: Date.now(),
        sessionData: {
          ...prev.sessionData,
          id: sessionId,
          disciplines: selectedDisciplines,
          concepts,
          sessionType: 'exploration',
          interactions: [],
          conceptCount
        }
      }));

      toast({
        title: "Session Started",
        description: `Exploring ${conceptCount} concepts across ${selectedDisciplines.length} disciplines`,
      });
    } catch (error) {
      console.error('Error starting session:', error);
      handleError(error as Error);
      
      toast({
        title: "Error",
        description: "Failed to start session. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleConceptInteraction = (conceptId: string, action: string) => {
    try {
      const interaction = {
        conceptId,
        action,
        timestamp: Date.now() - gameState.startTime
      };
      
      updateGameState(prev => ({
        ...prev,
        sessionData: {
          ...prev.sessionData,
          interactions: [...prev.sessionData.interactions, interaction]
        },
        currentConcepts: prev.currentConcepts.map(concept => 
          concept.id === conceptId 
            ? { ...concept, energy: Math.min(1, concept.energy + 0.1) }
            : concept
        )
      }));
    } catch (error) {
      console.error('Error handling concept interaction:', error);
      handleError(error as Error);
    }
  };

  const handleSessionEnd = async () => {
    try {
      const duration = Math.floor((Date.now() - gameState.startTime) / 1000);
      const finalSessionData = {
        ...gameState.sessionData,
        duration,
        concepts: gameState.currentConcepts
      };
      
      updateGameState(prev => ({
        ...prev,
        sessionData: finalSessionData,
        phase: 'interpretation'
      }));

      console.log('Saving session data:', finalSessionData);
      const sessionId = await gameSessionService.createSession(finalSessionData);
      
      if (sessionId) {
        updateGameState(prev => ({
          ...prev,
          currentSessionId: sessionId
        }));
        
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
      handleError(error as Error);
      
      toast({
        title: "Warning",
        description: "Session completed but could not be saved",
        variant: "destructive"
      });
    }
  };

  const handleNewSession = () => {
    updateGameState(initialGameState);
    resetErrors();
  };

  const handleBackToMenu = () => {
    updateGameState(prev => ({
      ...prev,
      phase: 'start'
    }));
  };

  const handleGameReset = () => {
    emergencyReset();
    resetErrors();
    toast({
      title: "Game Reset",
      description: "The game has been reset to initial state",
    });
  };

  return (
    <GameErrorBoundary 
      onGameReset={handleGameReset}
      gamePhase={gameState.phase}
    >
      <AudioProvider>
        <div className="min-h-screen">
          {gameState.phase === 'start' && (
            <ErrorBoundary level="section">
              <SessionStartFlow
                disciplines={disciplines}
                onSessionStart={handleSessionStart}
              />
            </ErrorBoundary>
          )}
          
          {gameState.phase === 'arena' && (
            <ErrorBoundary level="section">
              <SphericalArena
                disciplines={disciplines}
                selectedDisciplines={gameState.sessionData.disciplines}
                concepts={gameState.currentConcepts}
                onConceptInteraction={handleConceptInteraction}
                onSessionEnd={handleSessionEnd}
              />
            </ErrorBoundary>
          )}
          
          {gameState.phase === 'interpretation' && (
            <ErrorBoundary level="section">
              <AIInterpretation
                sessionData={gameState.sessionData}
                onNewSession={handleNewSession}
                onBackToMenu={handleBackToMenu}
              />
            </ErrorBoundary>
          )}
          
          {/* Recovery Options for Development */}
          {process.env.NODE_ENV === 'development' && hasSnapshots && (
            <div className="fixed top-4 left-4 bg-black/80 text-white p-2 rounded text-xs">
              <div>Recovery Options:</div>
              <button 
                onClick={() => restoreFromSnapshot(0)}
                className="block text-yellow-400 hover:text-yellow-300"
              >
                Restore Last Save
              </button>
              <button 
                onClick={handleGameReset}
                className="block text-red-400 hover:text-red-300"
              >
                Emergency Reset
              </button>
            </div>
          )}
        </div>
      </AudioProvider>
    </GameErrorBoundary>
  );
};
