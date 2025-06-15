
import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SessionHeaderProps {
  remainingTime: number;
  formatTime: () => string;
  onEndSession: () => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  remainingTime,
  formatTime,
  onEndSession
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="absolute top-2 md:top-4 right-2 md:right-4 z-10 flex items-center gap-2 md:gap-4">
      <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-lg backdrop-blur-sm text-xs md:text-sm ${
        remainingTime <= 30 ? 'bg-red-900/80 text-red-200' : 'bg-gray-900/80 text-gray-200'
      }`}>
        <Clock className="h-3 w-3 md:h-4 md:w-4" />
        <span className="font-mono">{formatTime()}</span>
      </div>
      
      {remainingTime <= 30 && (
        <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-lg bg-orange-900/80 text-orange-200">
          <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
          <span className="text-xs md:text-sm hidden sm:inline">Session ending soon!</span>
          <span className="text-xs md:text-sm sm:hidden">Ending!</span>
        </div>
      )}
      
      <Button
        onClick={onEndSession}
        size={isMobile ? "sm" : "default"}
        className="bg-gradient-to-r from-blue-600 to-purple-600 opacity-80 hover:opacity-100 transition-opacity text-xs md:text-sm"
      >
        End Session
      </Button>
    </div>
  );
};
