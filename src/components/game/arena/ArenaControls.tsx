
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { formatTime } from './utils';
import { RotationRef } from './types';

interface ArenaControlsProps {
  sessionTime: number;
  conceptCount: number;
  isPaused: boolean;
  onPauseToggle: () => void;
  onResetRotation: () => void;
  onSessionEnd: () => void;
  rotationRef: React.MutableRefObject<RotationRef>;
}

export const ArenaControls: React.FC<ArenaControlsProps> = ({
  sessionTime,
  conceptCount,
  isPaused,
  onPauseToggle,
  onResetRotation,
  onSessionEnd,
  rotationRef
}) => {
  const handleResetRotation = () => {
    rotationRef.current = { x: 0, y: 0 };
    onResetRotation();
  };

  return (
    <div className="flex justify-between items-center p-4 bg-gray-900/50 backdrop-blur">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="border-blue-400 text-blue-400">
          {formatTime(sessionTime)}
        </Badge>
        <Badge variant="outline" className="border-green-400 text-green-400">
          {conceptCount} Concepts Active
        </Badge>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onPauseToggle}
          className="border-purple-400 text-purple-400"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
        <Button
          variant="outline"
          onClick={handleResetRotation}
          className="border-gray-400 text-gray-400"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          onClick={onSessionEnd}
          className="bg-gradient-to-r from-blue-600 to-purple-600"
        >
          End Session
        </Button>
      </div>
    </div>
  );
};
