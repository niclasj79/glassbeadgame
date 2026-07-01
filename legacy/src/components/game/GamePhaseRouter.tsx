import React from 'react';
import { ErrorBoundary } from '../error/ErrorBoundary';
import { SessionStartFlow } from './SessionStartFlow';
import { SphericalArena } from './SphericalArena';
import { AIInterpretation } from './AIInterpretation';

interface GamePhaseRouterProps {
  phase: 'start' | 'arena' | 'interpretation';
  disciplines: any[];
  gameState: any;
  onSessionStart: (selectedDisciplines: string[], conceptCount: number, selectedConcepts?: { [disciplineId: string]: string }) => Promise<void>;
  onConceptInteraction: (conceptId: string, action: string) => void;
  onSessionEnd: () => Promise<void>;
  onNewSession: () => void;
  onBackToMenu: () => void;
  onDiscoveriesUpdate?: (discoveries: any[], score: any) => void;
}

export const GamePhaseRouter: React.FC<GamePhaseRouterProps> = ({
  phase,
  disciplines,
  gameState,
  onSessionStart,
  onConceptInteraction,
  onSessionEnd,
  onNewSession,
  onBackToMenu,
  onDiscoveriesUpdate
}) => {
  switch (phase) {
    case 'start':
      return (
        <ErrorBoundary level="section">
          <SessionStartFlow disciplines={disciplines} onSessionStart={onSessionStart} />
        </ErrorBoundary>
      );

    case 'arena':
      return (
        <ErrorBoundary level="section">
          <SphericalArena
            disciplines={disciplines}
            selectedDisciplines={gameState.sessionData.disciplines}
            concepts={gameState.currentConcepts}
            onConceptInteraction={onConceptInteraction}
            onSessionEnd={onSessionEnd}
            onDiscoveriesUpdate={onDiscoveriesUpdate}
          />
        </ErrorBoundary>
      );

    case 'interpretation':
      return (
        <ErrorBoundary level="section">
          <AIInterpretation
            sessionData={gameState.sessionData}
            onNewSession={onNewSession}
            onBackToMenu={onBackToMenu}
          />
        </ErrorBoundary>
      );

    default:
      return null;
  }
};
