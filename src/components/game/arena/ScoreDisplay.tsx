import React from 'react';
import { Sparkles } from 'lucide-react';
import { GameScore } from './types';

interface ScoreDisplayProps {
  score: GameScore;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score }) => {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg game-surface backdrop-blur-sm">
      <Sparkles className="w-4 h-4 text-game-resonance" />
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-game-resonance">{score.totalResonance}</span>
        <span className="text-xs game-text-dim hidden sm:inline">resonance</span>
      </div>
      <div className="w-px h-4 bg-game-glow/20" />
      <span className="text-xs game-text-dim">{score.discoveriesCount} discoveries</span>
      <div className="w-px h-4 bg-game-glow/20 hidden sm:block" />
      <span className="text-xs text-game-synthesis hidden sm:inline">{score.rank}</span>
    </div>
  );
};
