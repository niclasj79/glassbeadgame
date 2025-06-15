
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface VisualizerErrorBoundaryProps {
  children: React.ReactNode;
  onDisable?: () => void;
}

export const VisualizerErrorBoundary: React.FC<VisualizerErrorBoundaryProps> = ({
  children,
  onDisable
}) => {
  const handleError = (error: Error) => {
    console.error('Visualizer error:', error);
    
    // Check if it's a WebGL or canvas-related error
    const isRenderingError = error.message.includes('WebGL') || 
                            error.message.includes('canvas') ||
                            error.message.includes('getContext');
    
    if (isRenderingError) {
      console.warn('Rendering error detected, may need to disable advanced features');
    }
  };

  const VisualizerErrorFallback = () => (
    <div className="bg-black border-gray-700 rounded-lg p-6 text-center">
      <Alert variant="destructive" className="mb-4">
        <EyeOff className="h-4 w-4" />
        <AlertTitle>Visualizer Error</AlertTitle>
        <AlertDescription>
          The audio visualizer encountered an error. This may be due to browser compatibility 
          or graphics limitations.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-2">
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="w-full"
        >
          <Eye className="h-4 w-4 mr-2" />
          Retry Visualizer
        </Button>
        
        {onDisable && (
          <Button 
            variant="ghost" 
            onClick={onDisable}
            className="w-full text-gray-400"
          >
            Continue Without Visualizer
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="component"
      onError={handleError}
      fallback={<VisualizerErrorFallback />}
      enableRecovery={true}
    >
      {children}
    </ErrorBoundary>
  );
};
