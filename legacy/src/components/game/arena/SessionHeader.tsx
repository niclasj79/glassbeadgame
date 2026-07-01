import React from 'react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScoreDisplay } from './ScoreDisplay';
import { GameScore } from './types';

interface SessionHeaderProps {
  remainingTime: number;
  maxDuration?: number;
  formatTime: () => string;
  onEndSession: () => void;
  score?: GameScore;
  discoveriesCount?: number;
  totalPossible?: number;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  remainingTime,
  maxDuration = 300,
  formatTime,
  onEndSession,
  score,
  discoveriesCount = 0,
  totalPossible = 0
}) => {
  const isMobile = useIsMobile();
  const progress = maxDuration > 0 ? Math.max(0, remainingTime / maxDuration) : 1;

  return (
    <>
      {/* Thin progress bar at very top */}
      <div className="fixed top-0 left-0 right-0 z-40 h-1" style={{ background: 'hsla(240, 20%, 15%, 0.6)' }}>
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progress * 100}%`,
            background: progress > 0.25
              ? 'linear-gradient(90deg, hsl(260, 80%, 65%), hsl(200, 80%, 60%))'
              : 'linear-gradient(90deg, hsl(0, 70%, 55%), hsl(30, 80%, 55%))',
          }}
        />
      </div>

      <div className="fixed top-1 left-0 right-0 z-30 flex items-center justify-between gap-2 md:gap-4 p-2 md:p-4">
        {/* Score display */}
        <div className="flex items-center gap-2">
          {score && <ScoreDisplay score={score} />}
          {totalPossible > 0 && (
            <div className="px-2 py-1 rounded text-xs backdrop-blur-sm"
              style={{
                background: 'hsla(var(--game-surface-elevated), 0.8)',
                color: 'hsl(var(--game-text-dim))'
              }}>
              {discoveriesCount}/{totalPossible} found
            </div>
          )}
        </div>

        {/* End button only - timer is the progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono opacity-60" style={{ color: 'hsl(var(--game-text-dim))' }}>
            {formatTime()}
          </span>
          <Button
            onClick={onEndSession}
            size={isMobile ? "sm" : "default"}
            variant="outline"
            className="border-game-glow/30 text-game-glow hover:bg-game-glow/10 text-xs md:text-sm"
          >
            End
          </Button>
        </div>
      </div>
    </>
  );
};
