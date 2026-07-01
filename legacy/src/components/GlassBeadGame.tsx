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
    { id: 'mathematics', name: 'Mathematics', color: '#60A5FA', icon: '∑' },
    { id: 'music', name: 'Music Theory', color: '#34D399', icon: '♪' },
    { id: 'philosophy', name: 'Philosophy', color: '#A78BFA', icon: 'Φ' },
    { id: 'physics', name: 'Physics', color: '#FBBF24', icon: 'Ψ' },
    { id: 'art', name: 'Visual Arts', color: '#FB7185', icon: '◊' },
    { id: 'history', name: 'History & Politics', color: '#22D3EE', icon: '⚖' }
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
