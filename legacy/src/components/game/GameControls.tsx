
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Book } from 'lucide-react';
import { GameState } from '../GlassBeadGame';

interface GameControlsProps {
  gameState: GameState;
  onStartGame: () => void;
  onToggleDepth: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  gameState,
  onStartGame,
  onToggleDepth
}) => {
  return (
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
  );
};

export const ActionButtons: React.FC<{
  selectedDisciplines: string[];
  onStartGame: () => void;
  onToggleDepth: () => void;
}> = ({ selectedDisciplines, onStartGame, onToggleDepth }) => {
  return (
    <div className="flex gap-4 mb-6">
      <Button 
        onClick={onStartGame}
        disabled={selectedDisciplines.length === 0}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
      >
        <Play className="w-4 h-4 mr-2" />
        Begin Synthesis
      </Button>
      <Button 
        variant="outline"
        onClick={onToggleDepth}
        className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white"
      >
        <Book className="w-4 h-4 mr-2" />
        Theoretical Depth
      </Button>
    </div>
  );
};
