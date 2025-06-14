
import React, { useState, useEffect } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { DisciplinePanel } from './game/DisciplinePanel';
import { PlayerInterface } from './game/PlayerInterface';
import { TheoreticalDepth } from './game/TheoreticalDepth';
import { CollaborativeSpace } from './game/CollaborativeSpace';
import { AudioProvider } from './audio/AudioEngine';
import { AudioControls } from './audio/AudioControls';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Users, Book, Sparkles, Headphones, History } from 'lucide-react';

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

  return (
    <AudioProvider>
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white">
        {/* Header */}
        <div className="relative z-10 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Das Glasperlenspiel
              </h1>
              <p className="text-gray-300 mt-2">
                An immersive synesthetic synthesis of all human knowledge
              </p>
            </div>
            <div className="flex gap-4">
              <Badge variant="outline" className="border-blue-400 text-blue-400">
                {gameState.selectedDisciplines.length} Disciplines Active
              </Badge>
              <Badge variant="outline" className="border-green-400 text-green-400">
                {gameState.collaborators.length} Collaborators
              </Badge>
            </div>
          </div>

          {/* Enhanced Discipline Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Book className="w-5 h-5" />
              Select Knowledge Domains
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {disciplines.map(discipline => (
                <Card 
                  key={discipline.id}
                  className={`p-4 cursor-pointer transition-all duration-300 hover:scale-105 ${
                    gameState.selectedDisciplines.includes(discipline.id)
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-2 border-white shadow-lg'
                      : 'bg-gray-800 hover:bg-gray-700 border border-gray-600'
                  }`}
                  onClick={() => handleDisciplineSelect(discipline.id)}
                >
                  <div className="text-center">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2"
                      style={{ backgroundColor: discipline.color }}
                    >
                      {discipline.icon}
                    </div>
                    <span className="text-sm font-medium">{discipline.name}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={startGame}
              disabled={gameState.selectedDisciplines.length === 0}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Begin Synthesis
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowDepth(!showDepth)}
              className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white"
            >
              <Book className="w-4 h-4 mr-2" />
              Theoretical Depth
            </Button>
          </div>
        </div>

        {/* Main Game Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-10">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
            <TabsTrigger value="play" className="data-[state=active]:bg-purple-600">
              <Sparkles className="w-4 h-4 mr-2" />
              Play
            </TabsTrigger>
            <TabsTrigger value="collaborate" className="data-[state=active]:bg-blue-600">
              <Users className="w-4 h-4 mr-2" />
              Collaborate
            </TabsTrigger>
            <TabsTrigger value="explore" className="data-[state=active]:bg-green-600">
              <Book className="w-4 h-4 mr-2" />
              Explore
            </TabsTrigger>
            <TabsTrigger value="audio" className="data-[state=active]:bg-indigo-600">
              <Headphones className="w-4 h-4 mr-2" />
              Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="play" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
              <div className="lg:col-span-3">
                <GameCanvas 
                  disciplines={disciplines}
                  gameState={gameState}
                  onStateChange={setGameState}
                  isPlaying={isPlaying}
                />
              </div>
              <div className="space-y-4">
                <PlayerInterface 
                  gameState={gameState}
                  onStateChange={setGameState}
                  disciplines={disciplines}
                />
                <DisciplinePanel 
                  selectedDisciplines={gameState.selectedDisciplines}
                  disciplines={disciplines}
                  onDisciplineInteract={handleDisciplineSelect}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="collaborate" className="mt-0">
            <CollaborativeSpace 
              gameState={gameState}
              onStateChange={setGameState}
              disciplines={disciplines}
            />
          </TabsContent>

          <TabsContent value="explore" className="mt-0">
            <TheoreticalDepth 
              disciplines={disciplines}
              selectedDisciplines={gameState.selectedDisciplines}
              explorationDepth={gameState.explorationDepth}
            />
          </TabsContent>

          <TabsContent value="audio" className="mt-0">
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AudioControls />
                <Card className="bg-gray-800 border-gray-700 p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Synesthetic Experience</h3>
                  <div className="space-y-4 text-gray-300">
                    <p>
                      The Glass Bead Game creates a unique synesthetic experience where:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                      <li>Each discipline has its own distinctive audio signature</li>
                      <li>Node interactions generate harmonic frequencies</li>
                      <li>Synthesis events create complex musical patterns</li>
                      <li>Visual particles respond to audio frequencies</li>
                      <li>Ambient layers provide contextual atmosphere</li>
                    </ul>
                    <div className="pt-4 border-t border-gray-700">
                      <h4 className="font-medium mb-2">Audio-Visual Mapping:</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {disciplines.map(discipline => (
                          <div key={discipline.id} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: discipline.color }}
                            />
                            <span>{discipline.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

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
