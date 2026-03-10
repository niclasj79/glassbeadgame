import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useStateRecovery } from '@/hooks/useStateRecovery';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';
import { conceptGenerator, Concept } from '../ConceptGenerator';
import { gameSessionService, GameSessionData } from '../GameSessionService';
import { isFeatureEnabled } from '@/config/featureFlags';
import { SynthesisDiscovery, GameScore } from '../arena/types';

interface GameSessionState {
  phase: 'start' | 'arena' | 'interpretation';
  sessionData: GameSessionData & {
    discoveries?: SynthesisDiscovery[];
    score?: GameScore;
  };
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
    conceptCount: 0,
    discoveries: [],
    score: { totalResonance: 0, discoveriesCount: 0, uniquePairsCount: 0, rank: 'Novice' }
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
    onError: () => {
      toast({ title: "Game Error", description: "An error occurred. Attempting recovery.", variant: "destructive" });
    },
    onRecovery: () => {
      toast({ title: "Recovered", description: "The game recovered successfully." });
    }
  });

  const handleDiscoveriesUpdate = useCallback((discoveries: SynthesisDiscovery[], score: GameScore) => {
    updateGameState(prev => ({
      ...prev,
      sessionData: {
        ...prev.sessionData,
        discoveries,
        score
      }
    }));
  }, [updateGameState]);

  const handleSessionStart = async (
    selectedDisciplines: string[],
    conceptCount: number = 15,
    selectedConcepts?: { [disciplineId: string]: string }
  ) => {
    try {
      const conceptsToUse = isFeatureEnabled('hesseInsights') ? selectedConcepts : undefined;
      const concepts = await conceptGenerator.generateConcepts(selectedDisciplines, conceptCount, conceptsToUse);

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
          conceptCount,
          discoveries: [],
          score: { totalResonance: 0, discoveriesCount: 0, uniquePairsCount: 0, rank: 'Novice' }
        }
      }));

      toast({
        title: "Session Started",
        description: `Exploring ${conceptCount} concepts across ${selectedDisciplines.length} disciplines`,
      });
    } catch (error) {
      console.error('Error starting session:', error);
      handleError(error as Error);
      toast({ title: "Error", description: "Failed to start session.", variant: "destructive" });
    }
  };

  const handleConceptInteraction = (conceptId: string, action: string) => {
    try {
      const interaction = { conceptId, action, timestamp: Date.now() - gameState.startTime };
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

      const sessionId = await gameSessionService.createSession(finalSessionData);
      if (sessionId) {
        updateGameState(prev => ({ ...prev, currentSessionId: sessionId }));
      }
    } catch (error) {
      console.error('Error saving session:', error);
      // Still transition to interpretation
      updateGameState(prev => ({ ...prev, phase: 'interpretation' }));
    }
  };

  const handleNewSession = () => {
    updateGameState(initialGameState);
    resetErrors();
  };

  const handleBackToMenu = () => {
    updateGameState(prev => ({ ...prev, phase: 'start' }));
  };

  const handleGameReset = () => {
    emergencyReset();
    resetErrors();
    toast({ title: "Game Reset", description: "Reset to initial state" });
  };

  return {
    gameState,
    handleSessionStart,
    handleConceptInteraction,
    handleSessionEnd,
    handleNewSession,
    handleBackToMenu,
    handleGameReset,
    handleDiscoveriesUpdate,
    restoreFromSnapshot,
    hasSnapshots
  };
};
