import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScoreDisplay } from './ScoreDisplay';
import { GameScore } from './types';

interface SessionHeaderProps {
  remainingTime: number;
  formatTime: () => string;
  onEndSession: () => void;
  score?: GameScore;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  remainingTime,
  formatTime,
  onEndSession,
  score
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 md:gap-4 p-2 md:p-4">
      {/* Score display */}
      <div className="flex items-center gap-2">
        {score && <ScoreDisplay score={score} />}
      </div>

      {/* Timer + end button */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 rounded-lg backdrop-blur-sm text-xs md:text-sm ${
          remainingTime <= 30 ? 'bg-destructive/30 text-destructive-foreground' : 'game-surface'
        }`}>
          <Clock className="h-3 w-3 md:h-4 md:w-4" />
          <span className="font-mono game-text-bright">{formatTime()}</span>
        </div>

        {remainingTime <= 30 && (
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-destructive/20">
            <AlertCircle className="h-3 w-3 text-destructive" />
            <span className="text-xs hidden sm:inline text-destructive">Ending soon</span>
          </div>
        )}

        <Button
          onClick={onEndSession}
          size={isMobile ? "sm" : "default"}
          variant="outline"
          className="border-game-glow/30 text-game-glow hover:bg-game-glow/10 text-xs md:text-sm"
        >
          End Session
        </Button>
      </div>
    </div>
  );
};
