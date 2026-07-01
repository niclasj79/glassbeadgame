
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { GameState } from '../GlassBeadGame';
import { Play, Pause, RotateCcw, Sparkles } from 'lucide-react';

interface PlayerInterfaceProps {
  gameState: GameState;
  onStateChange: (state: GameState) => void;
  disciplines: any[];
}

export const PlayerInterface: React.FC<PlayerInterfaceProps> = ({
  gameState,
  onStateChange,
  disciplines
}) => {
  const [playerName, setPlayerName] = useState('Anonymous Player');
  const [intention, setIntention] = useState('');
  const [resonanceLevel, setResonanceLevel] = useState([50]);
  const [harmonyMode, setHarmonyMode] = useState(false);

  const performSynthesis = () => {
    const synthesis = {
      player: playerName,
      intention: intention,
      disciplines: gameState.selectedDisciplines,
      resonance: resonanceLevel[0],
      timestamp: Date.now(),
      harmony: harmonyMode
    };

    onStateChange({
      ...gameState,
      currentSynthesis: synthesis,
      explorationDepth: gameState.explorationDepth + 1
    });

    // Clear intention after synthesis
    setIntention('');
  };

  const resetGame = () => {
    onStateChange({
      ...gameState,
      selectedDisciplines: [],
      currentSynthesis: null,
      explorationDepth: 0
    });
  };

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Player Interface</h3>
        <Badge variant="outline" className="border-purple-400 text-purple-400">
          Depth: {gameState.explorationDepth}
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Player Name</label>
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white"
            placeholder="Enter your name..."
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Synthesis Intention</label>
          <Input
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white"
            placeholder="What synthesis do you seek?"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Resonance Level: {resonanceLevel[0]}%
          </label>
          <Slider
            value={resonanceLevel}
            onValueChange={setResonanceLevel}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant={harmonyMode ? "default" : "outline"}
            size="sm"
            onClick={() => setHarmonyMode(!harmonyMode)}
            className={harmonyMode ? "bg-purple-600 hover:bg-purple-700" : "border-purple-400 text-purple-400"}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Harmony Mode
          </Button>
          <Badge variant="secondary" className="bg-gray-700 text-gray-300">
            {harmonyMode ? 'Collaborative' : 'Individual'}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={performSynthesis}
            disabled={!intention.trim() || gameState.selectedDisciplines.length === 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Play className="w-4 h-4 mr-2" />
            Synthesize
          </Button>
          <Button
            variant="outline"
            onClick={resetGame}
            className="border-gray-600 text-gray-400 hover:bg-gray-700"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {gameState.currentSynthesis && (
        <Card className="bg-gradient-to-r from-purple-900 to-blue-900 p-3 border-purple-400">
          <h4 className="text-sm font-semibold text-white mb-2">Latest Synthesis</h4>
          <p className="text-xs text-gray-300 mb-1">
            <strong>Intention:</strong> {gameState.currentSynthesis.intention}
          </p>
          <p className="text-xs text-gray-300 mb-1">
            <strong>Resonance:</strong> {gameState.currentSynthesis.resonance}%
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {gameState.currentSynthesis.disciplines.map((disciplineId: string) => {
              const discipline = disciplines.find(d => d.id === disciplineId);
              return discipline ? (
                <Badge 
                  key={disciplineId}
                  variant="secondary"
                  className="text-xs"
                  style={{ backgroundColor: discipline.color + '40' }}
                >
                  {discipline.icon} {discipline.name}
                </Badge>
              ) : null;
            })}
          </div>
        </Card>
      )}
    </Card>
  );
};
