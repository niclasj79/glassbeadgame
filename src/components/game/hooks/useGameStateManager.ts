
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useStateRecovery } from '@/hooks/useStateRecovery';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';
import { conceptGenerator, Concept } from '../ConceptGenerator';
import { gameSessionService, GameSessionData } from '../GameSessionService';

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

export const useGameStateManager = () => {
  const { toast } = useToast();
  
  const {
    state: gameState,
    updateState: updateGameState,
    restoreFromSnapshot,
    hasSnapshots,
    emergencyReset
  } = useStateRecovery(initialGameState, {
    persistKey: 'glass-bead-game-state',
    snapshotInterval: 30000,
    enablePersistence: true
  });

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

  const handleSessionStart = async (
    selectedDisciplines: string[], 
    conceptCount: number = 15, 
    selectedConcepts?: { [disciplineId: string]: string }
  ) => {
    try {
      console.log('Starting session with disciplines:', selectedDisciplines, 'concepts:', conceptCount, 'selected:', selectedConcepts);
      
      const concepts = await conceptGenerator.generateConcepts(selectedDisciplines, conceptCount, selectedConcepts);
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

  return {
    gameState,
    handleSessionStart,
    handleConceptInteraction,
    handleSessionEnd,
    handleNewSession,
    handleBackToMenu,
    handleGameReset,
    restoreFromSnapshot,
    hasSnapshots
  };
};
