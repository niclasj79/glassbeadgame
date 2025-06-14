
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AudioProvider } from './audio/AudioEngine';
import { GameControls, ActionButtons } from './game/GameControls';
import { DisciplineSelector } from './game/DisciplineSelector';
import { GameTabs } from './game/GameTabs';
import { TheoreticalDepth } from './game/TheoreticalDepth';

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
  const [gameState, setGameState] = useState<GameState>({
    activePlayer: 'player1',
    selectedDisciplines: [],
    currentSynthesis: null,
    collaborators: [],
    explorationDepth: 0
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('play');
  const [showDepth, setShowDepth] = useState(false);

  const disciplines = [
    { id: 'mathematics', name: 'Mathematics', color: '#3B82F6', icon: '∑' },
    { id: 'music', name: 'Music Theory', color: '#10B981', icon: '♪' },
    { id: 'philosophy', name: 'Philosophy', color: '#8B5CF6', icon: 'Φ' },
    { id: 'physics', name: 'Physics', color: '#F59E0B', icon: 'Ψ' },
    { id: 'art', name: 'Visual Arts', color: '#EF4444', icon: '◊' },
    { id: 'history', name: 'History & Politics', color: '#06B6D4', icon: '⚖' }
  ];

  const handleDisciplineSelect = (disciplineId: string) => {
    setGameState(prev => ({
      ...prev,
      selectedDisciplines: prev.selectedDisciplines.includes(disciplineId)
        ? prev.selectedDisciplines.filter(id => id !== disciplineId)
        : [...prev.selectedDisciplines, disciplineId]
    }));
  };

  const startGame = () => {
    setIsPlaying(true);
    setActiveTab('play');
  };

  const toggleDepth = () => {
    setShowDepth(!showDepth);
  };

  return (
    <AudioProvider>
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white">
        {/* Header */}
        <div className="relative z-10 p-6">
          <GameControls 
            gameState={gameState}
            onStartGame={startGame}
            onToggleDepth={toggleDepth}
          />

          <DisciplineSelector 
            disciplines={disciplines}
            selectedDisciplines={gameState.selectedDisciplines}
            onDisciplineSelect={handleDisciplineSelect}
          />

          <ActionButtons 
            selectedDisciplines={gameState.selectedDisciplines}
            onStartGame={startGame}
            onToggleDepth={toggleDepth}
          />
        </div>

        {/* Main Game Interface */}
        <GameTabs 
          activeTab={activeTab}
          onTabChange={setActiveTab}
          gameState={gameState}
          onStateChange={setGameState}
          disciplines={disciplines}
          isPlaying={isPlaying}
          onDisciplineSelect={handleDisciplineSelect}
        />

        {/* Theoretical Depth Overlay */}
        {showDepth && (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-6">
            <div className="bg-gray-900 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Theoretical Foundations</h2>
                <Button variant="outline" onClick={() => setShowDepth(false)}>
                  Close
                </Button>
              </div>
              <TheoreticalDepth 
                disciplines={disciplines}
                selectedDisciplines={gameState.selectedDisciplines}
                explorationDepth={gameState.explorationDepth}
              />
            </div>
          </div>
        )}
      </div>
    </AudioProvider>
  );
};
