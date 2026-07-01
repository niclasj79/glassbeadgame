
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { GameCanvas } from './GameCanvas';
import { DisciplinePanel } from './DisciplinePanel';
import { PlayerInterface } from './PlayerInterface';
import { CollaborativeSpace } from './CollaborativeSpace';
import { TheoreticalDepth } from './TheoreticalDepth';
import { AudioControls } from '../audio/AudioControls';
import { GameState } from '../GlassBeadGame';
import { Play, Users, Book, Sparkles, Headphones } from 'lucide-react';

interface GameTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  gameState: GameState;
  onStateChange: (state: GameState) => void;
  disciplines: any[];
  isPlaying: boolean;
  onDisciplineSelect: (disciplineId: string) => void;
}

export const GameTabs: React.FC<GameTabsProps> = ({
  activeTab,
  onTabChange,
  gameState,
  onStateChange,
  disciplines,
  isPlaying,
  onDisciplineSelect
}) => {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="relative z-10">
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
              onStateChange={onStateChange}
              isPlaying={isPlaying}
            />
          </div>
          <div className="space-y-4">
            <PlayerInterface 
              gameState={gameState}
              onStateChange={onStateChange}
              disciplines={disciplines}
            />
            <DisciplinePanel 
              selectedDisciplines={gameState.selectedDisciplines}
              disciplines={disciplines}
              onDisciplineInteract={onDisciplineSelect}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="collaborate" className="mt-0">
        <CollaborativeSpace 
          gameState={gameState}
          onStateChange={onStateChange}
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
  );
};
