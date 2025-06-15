
import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import { useParticleSystem } from './hooks/useParticleSystem';
import { useVisualizerPerformance } from './hooks/useVisualizerPerformance';
import { useVisualizerCanvas } from './hooks/useVisualizerCanvas';
import { VisualizerSettings } from './VisualizerSettings';

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
  const [settings, setSettings] = useState<VisualizationSettings>({
    particleDensity: 1.0,
    trailLength: 8,
    colorMode: 'mixed',
    responseTime: 0.1,
    depthLayers: true
  });

  const { performanceMode, fps, updatePerformanceMode } = useVisualizerPerformance();
  
  const { particles, updateParticles } = useParticleSystem({
    settings,
    canvasRef,
    resonanceLevel,
    performanceMode
  });

  const { drawVisualization } = useVisualizerCanvas({
    canvasRef,
    particles,
    settings,
    activeFrequencies,
    disciplines,
    resonanceLevel,
    performanceMode
  });

  // Main animation loop
  useEffect(() => {
    if (!isVisible) return;

    const animate = () => {
      updatePerformanceMode();
      updateParticles(activeFrequencies, disciplines, spatialPositions);
      drawVisualization();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, updatePerformanceMode, updateParticles, drawVisualization, activeFrequencies, disciplines, spatialPositions]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const resizeCanvas = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      };
      
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, []);

  // Auto-show/hide based on activity
  useEffect(() => {
    setIsVisible(activeFrequencies.length > 0 || spatialPositions.length > 0);
  }, [activeFrequencies, spatialPositions]);

  if (!isVisible) return null;

  return (
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
};
