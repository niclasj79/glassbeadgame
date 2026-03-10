import React from 'react';
import { AudioProvider } from './audio/AudioEngine';
import { GameErrorBoundary } from './error/GameErrorBoundary';
import { GamePhaseRouter } from './game/GamePhaseRouter';
import { DevelopmentRecoveryPanel } from './game/DevelopmentRecoveryPanel';
import { useGameStateManager } from './game/hooks/useGameStateManager';

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
  const {
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
  } = useGameStateManager();

  const disciplines = [
    { id: 'mathematics', name: 'Mathematics', color: '#3B82F6', icon: '∑' },
    { id: 'music', name: 'Music Theory', color: '#10B981', icon: '♪' },
    { id: 'philosophy', name: 'Philosophy', color: '#8B5CF6', icon: 'Φ' },
    { id: 'physics', name: 'Physics', color: '#F59E0B', icon: 'Ψ' },
    { id: 'art', name: 'Visual Arts', color: '#EF4444', icon: '◊' },
    { id: 'history', name: 'History & Politics', color: '#06B6D4', icon: '⚖' }
  ];

  return (
    <GameErrorBoundary
      onGameReset={handleGameReset}
      gamePhase={gameState.phase}
    >
      <AudioProvider>
        <div className="min-h-screen">
          <GamePhaseRouter
            phase={gameState.phase}
            disciplines={disciplines}
            gameState={gameState}
            onSessionStart={handleSessionStart}
            onConceptInteraction={handleConceptInteraction}
            onSessionEnd={handleSessionEnd}
            onNewSession={handleNewSession}
            onBackToMenu={handleBackToMenu}
            onDiscoveriesUpdate={handleDiscoveriesUpdate}
          />

          <DevelopmentRecoveryPanel
            hasSnapshots={hasSnapshots}
            onRestoreSnapshot={() => restoreFromSnapshot(0)}
            onGameReset={handleGameReset}
          />
        </div>
      </AudioProvider>
    </GameErrorBoundary>
  );
};
