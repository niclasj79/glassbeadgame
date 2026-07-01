import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface GameErrorBoundaryProps {
  children: React.ReactNode;
  onGameReset?: () => void;
  gamePhase?: string;
}

export const GameErrorBoundary: React.FC<GameErrorBoundaryProps> = ({
  children,
  onGameReset,
  gamePhase
}) => {
  const handleError = (error: Error) => {
    console.error(`Game error in phase "${gamePhase}":`, error);
    
    // Save error state to localStorage for debugging
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        phase: gamePhase,
        error: error.message,
        stack: error.stack
      };
      
      const existingLogs = JSON.parse(localStorage.getItem('game-error-log') || '[]');
      existingLogs.push(errorLog);
      
      // Keep only last 10 errors
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      
      localStorage.setItem('game-error-log', JSON.stringify(existingLogs));
    } catch (logError) {
      console.warn('Failed to log error to localStorage:', logError);
    }
  };

  const GameErrorFallback = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Game Session Error</AlertTitle>
          <AlertDescription>
            The game encountered an unexpected error{gamePhase && ` during the ${gamePhase} phase`}. 
            Your progress may have been lost, but you can start a new session.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          {onGameReset && (
            <Button 
              onClick={onGameReset}
              className="w-full flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Start New Game Session
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Reload Application
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="page"
      onError={handleError}
      fallback={<GameErrorFallback />}
      enableRecovery={false}
    >
      {children}
    </ErrorBoundary>
  );
};
