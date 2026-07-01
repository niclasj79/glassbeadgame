
import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import { useParticleSystem } from './hooks/useParticleSystem';
import { useVisualizerPerformance } from './hooks/useVisualizerPerformance';
import { useVisualizerCanvas } from './hooks/useVisualizerCanvas';
import { VisualizerSettings } from './VisualizerSettings';
import { VisualizerErrorBoundary } from '../error/VisualizerErrorBoundary';
import { useGracefulDegradation } from '@/hooks/useGracefulDegradation';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';

interface EnhancedSynesthesiaVisualizerProps {
  activeFrequencies: number[];
  resonanceLevel: number;
  disciplines: string[];
  spatialPositions?: Array<{ x: number; y: number; z: number; discipline: string; intensity: number }>;
  className?: string;
}

interface VisualizationSettings {
  particleDensity: number;
  trailLength: number;
  colorMode: 'frequency' | 'discipline' | 'mixed';
  responseTime: number;
  depthLayers: boolean;
}

export const EnhancedSynesthesiaVisualizer: React.FC<EnhancedSynesthesiaVisualizerProps> = ({
  activeFrequencies,
  resonanceLevel,
  disciplines,
  spatialPositions = [],
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const [isVisible, setIsVisible] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  // Graceful degradation for performance optimization
  const { getOptimizedSettings, enableFallbackMode, featureSupport } = useGracefulDegradation();
  const optimizedSettings = getOptimizedSettings();

  // Error recovery for visualizer-specific errors
  const { handleError, retry } = useErrorRecovery({
    maxRetries: 2,
    retryDelay: 1000,
    onError: () => {
      console.warn('Visualizer error occurred, enabling fallback mode');
      enableFallbackMode();
    }
  });

  const [settings, setSettings] = useState<VisualizationSettings>({
    particleDensity: optimizedSettings.particleDensity,
    trailLength: optimizedSettings.enableTrails ? 8 : 0,
    colorMode: 'mixed',
    responseTime: 0.1,
    depthLayers: optimizedSettings.enableGlow
  });

  // Update settings based on performance optimization
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      particleDensity: optimizedSettings.particleDensity,
      trailLength: optimizedSettings.enableTrails ? prev.trailLength : 0,
      depthLayers: optimizedSettings.enableGlow && prev.depthLayers
    }));
  }, [optimizedSettings]);

  const { performanceMode, fps, updatePerformanceMode } = useVisualizerPerformance();
  
  const { particles, updateParticles } = useParticleSystem({
    settings,
    canvasRef,
    resonanceLevel,
    performanceMode: performanceMode || !optimizedSettings.enableParticles
  });

  const { drawVisualization } = useVisualizerCanvas({
    canvasRef,
    particles,
    settings,
    activeFrequencies,
    disciplines,
    resonanceLevel,
    performanceMode: performanceMode || !optimizedSettings.enableAnimations
  });

  // Main animation loop with error handling
  useEffect(() => {
    if (!isVisible || isDisabled || !optimizedSettings.enableAnimations) return;

    const animate = () => {
      try {
        updatePerformanceMode();
        updateParticles(activeFrequencies, disciplines, spatialPositions);
        drawVisualization();
        animationRef.current = requestAnimationFrame(animate);
      } catch (error) {
        console.error('Animation loop error:', error);
        handleError(error as Error);
        setIsDisabled(true);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, isDisabled, optimizedSettings.enableAnimations, updatePerformanceMode, updateParticles, drawVisualization, activeFrequencies, disciplines, spatialPositions, handleError]);

  // Canvas resize with error handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && featureSupport.canvas) {
      const resizeCanvas = () => {
        try {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
        } catch (error) {
          console.error('Canvas resize error:', error);
          handleError(error as Error);
        }
      };
      
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [featureSupport.canvas, handleError]);

  // Auto-show/hide based on activity
  useEffect(() => {
    setIsVisible(activeFrequencies.length > 0 || spatialPositions.length > 0);
  }, [activeFrequencies, spatialPositions]);

  const handleRetryVisualization = async () => {
    setIsDisabled(false);
    await retry(async () => {
      // Test basic canvas functionality
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    });
  };

  if (!isVisible && !isDisabled) return null;

  // Fallback UI when disabled
  if (isDisabled) {
    return (
      <div className={`relative ${className}`}>
        <Card className="bg-black border-gray-700 p-6 text-center">
          <p className="text-gray-400 mb-4">Visualizer temporarily disabled</p>
          <Button onClick={handleRetryVisualization} variant="outline">
            <Eye className="w-4 h-4 mr-2" />
            Retry Visualizer
          </Button>
        </Card>
      </div>
    );
  }

  const VisualizerContent = () => (
    <div className={`relative ${className}`}>
      <Card className="bg-black border-gray-700 overflow-hidden">
        {/* Main Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ minHeight: '250px' }}
        />

        {/* Controls Overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {fps.toFixed(0)} FPS
          </Badge>
          <Badge className={`text-xs ${performanceMode ? 'bg-yellow-600' : 'bg-green-600'}`}>
            {performanceMode ? 'Performance' : 'Quality'}
          </Badge>
          {!featureSupport.webGL && (
            <Badge variant="outline" className="text-xs bg-orange-600">
              Fallback
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowControls(!showControls)}
            className="h-6 w-6 p-0"
          >
            {showControls ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </Button>
        </div>

        {/* Settings Panel */}
        {showControls && (
          <div className="absolute bottom-2 left-2 right-2">
            <VisualizerSettings
              settings={settings}
              onSettingsChange={setSettings}
            />
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <VisualizerErrorBoundary onDisable={() => setIsDisabled(true)}>
      <VisualizerContent />
    </VisualizerErrorBoundary>
  );
};
