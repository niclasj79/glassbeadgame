
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Palette, Zap, Waves } from 'lucide-react';

interface EnhancedSynesthesiaVisualizerProps {
  activeFrequencies: number[];
  resonanceLevel: number;
  disciplines: string[];
  spatialPositions?: Array<{ x: number; y: number; z: number; discipline: string; intensity: number }>;
  className?: string;
}

interface AdvancedParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  frequency: number;
  discipline: string;
  life: number;
  maxLife: number;
  size: number;
  intensity: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
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
  const particlesRef = useRef<AdvancedParticle[]>([]);
  const settingsRef = useRef<VisualizationSettings>({
    particleDensity: 1.0,
    trailLength: 8,
    colorMode: 'mixed',
    responseTime: 0.1,
    depthLayers: true
  });

  const [isVisible, setIsVisible] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [settings, setSettings] = useState(settingsRef.current);
  const [performanceMode, setPerformanceMode] = useState(false);

  const disciplineColors = {
    mathematics: { h: 220, s: 70, l: 60 },
    music: { h: 120, s: 70, l: 60 },
    philosophy: { h: 270, s: 70, l: 60 },
    physics: { h: 30, s: 70, l: 60 },
    art: { h: 0, s: 70, l: 60 },
    history: { h: 180, s: 70, l: 60 }
  };

  // Update settings ref when state changes
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Performance monitoring
  const lastFrameTime = useRef(Date.now());
  const frameCount = useRef(0);
  const fpsRef = useRef(60);

  const updatePerformanceMode = useCallback(() => {
    frameCount.current++;
    if (frameCount.current % 60 === 0) {
      const now = Date.now();
      const delta = now - lastFrameTime.current;
      fpsRef.current = 1000 / (delta / 60);
      lastFrameTime.current = now;

      // Auto-adjust performance mode
      if (fpsRef.current < 30 && !performanceMode) {
        setPerformanceMode(true);
        console.log('Enhanced Synesthesia: Switching to performance mode');
      } else if (fpsRef.current > 50 && performanceMode) {
        setPerformanceMode(false);
        console.log('Enhanced Synesthesia: Switching to quality mode');
      }
    }
  }, [performanceMode]);

  // Enhanced color generation
  const getEnhancedColor = useCallback((frequency: number, discipline: string, intensity: number): string => {
    const { colorMode } = settingsRef.current;
    
    let hue: number, saturation: number, lightness: number;

    switch (colorMode) {
      case 'frequency':
        hue = (frequency / 1000) * 360;
        saturation = 60 + intensity * 40;
        lightness = 40 + intensity * 40;
        break;
      case 'discipline':
        const disciplineColor = disciplineColors[discipline as keyof typeof disciplineColors] || disciplineColors.mathematics;
        hue = disciplineColor.h;
        saturation = disciplineColor.s + intensity * 30;
        lightness = disciplineColor.l + intensity * 20;
        break;
      case 'mixed':
      default:
        const baseColor = disciplineColors[discipline as keyof typeof disciplineColors] || disciplineColors.mathematics;
        const freqOffset = (frequency / 1000) * 60 - 30;
        hue = (baseColor.h + freqOffset) % 360;
        saturation = baseColor.s + intensity * 30;
        lightness = baseColor.l + intensity * 20 + resonanceLevel * 15;
        break;
    }

    return `hsl(${hue}, ${Math.min(100, saturation)}%, ${Math.min(80, lightness)}%)`;
  }, [resonanceLevel]);

  // Create enhanced particle with 3D depth
  const createEnhancedParticle = useCallback((
    frequency: number, 
    discipline: string, 
    spatialPos?: { x: number; y: number; z: number; intensity: number }
  ): AdvancedParticle => {
    const canvas = canvasRef.current;
    if (!canvas) return {} as AdvancedParticle;

    const intensity = spatialPos?.intensity || (0.5 + Math.random() * 0.5);
    const z = spatialPos?.z || (Math.random() - 0.5) * 200;
    
    return {
      x: spatialPos?.x || Math.random() * canvas.width,
      y: spatialPos?.y || Math.random() * canvas.height,
      z,
      vx: (Math.random() - 0.5) * (2 + intensity),
      vy: (Math.random() - 0.5) * (2 + intensity),
      vz: (Math.random() - 0.5) * 0.5,
      frequency,
      discipline,
      life: 0,
      maxLife: 180 + Math.random() * 120,
      size: 1 + intensity * 3 + (frequency / 1000) * 2,
      intensity,
      trail: []
    };
  }, []);

  // Update particles with enhanced physics
  const updateEnhancedParticles = useCallback(() => {
    const { particleDensity, trailLength, responseTime } = settingsRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Update existing particles
    particlesRef.current = particlesRef.current.filter(particle => {
      // Update position with resonance influence
      const resonanceForce = resonanceLevel * 0.1;
      particle.vx += (Math.random() - 0.5) * resonanceForce;
      particle.vy += (Math.random() - 0.5) * resonanceForce;
      
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.z += particle.vz;
      particle.life += 1;

      // Update trail
      if (particle.trail.length > 0 || particle.life % 3 === 0) {
        particle.trail.push({ 
          x: particle.x, 
          y: particle.y, 
          alpha: 1 - (particle.life / particle.maxLife) 
        });
        
        if (particle.trail.length > trailLength) {
          particle.trail.shift();
        }
      }

      // Boundary interactions with elastic collision
      if (particle.x <= 0 || particle.x >= canvas.width) {
        particle.vx *= -0.8;
        particle.x = Math.max(0, Math.min(canvas.width, particle.x));
      }
      if (particle.y <= 0 || particle.y >= canvas.height) {
        particle.vy *= -0.8;
        particle.y = Math.max(0, Math.min(canvas.height, particle.y));
      }

      // Z-boundary (depth)
      if (particle.z < -100 || particle.z > 100) {
        particle.vz *= -0.7;
      }

      return particle.life < particle.maxLife;
    });

    // Add new particles based on spatial positions and frequencies
    spatialPositions.forEach((pos, index) => {
      const frequency = activeFrequencies[index % activeFrequencies.length] || 440;
      if (Math.random() < 0.4 * particleDensity) {
        // Convert 3D position to 2D canvas coordinates
        const scale = 1 + pos.z * 0.01; // Simple perspective
        const canvasX = (canvas.width / 2) + pos.x * scale;
        const canvasY = (canvas.height / 2) + pos.y * scale;
        
        particlesRef.current.push(createEnhancedParticle(frequency, pos.discipline, {
          x: canvasX,
          y: canvasY,
          z: pos.z,
          intensity: pos.intensity
        }));
      }
    });

    // Add ambient particles for active frequencies
    activeFrequencies.forEach((frequency, index) => {
      const discipline = disciplines[index % disciplines.length] || 'mathematics';
      if (Math.random() < 0.2 * particleDensity) {
        particlesRef.current.push(createEnhancedParticle(frequency, discipline));
      }
    });

    // Limit particles for performance
    const maxParticles = performanceMode ? 100 : 300;
    if (particlesRef.current.length > maxParticles) {
      particlesRef.current.splice(0, particlesRef.current.length - maxParticles);
    }
  }, [activeFrequencies, disciplines, spatialPositions, resonanceLevel, createEnhancedParticle, performanceMode]);

  // Enhanced drawing with depth layers and improved effects
  const drawEnhancedVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { depthLayers } = settingsRef.current;

    // Clear with dynamic background
    const bgAlpha = performanceMode ? 0.15 : 0.08;
    ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sort particles by depth for proper layering
    const sortedParticles = depthLayers 
      ? [...particlesRef.current].sort((a, b) => b.z - a.z)
      : particlesRef.current;

    // Draw background frequency waves
    if (!performanceMode) {
      activeFrequencies.forEach((frequency, index) => {
        const discipline = disciplines[index % disciplines.length] || 'mathematics';
        const color = getEnhancedColor(frequency, discipline, resonanceLevel);
        
        ctx.strokeStyle = color + '20';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let x = 0; x < canvas.width; x += 8) {
          const waveY = canvas.height / 2 + 
            Math.sin((x * frequency / 2000) + Date.now() * 0.003) * (15 + resonanceLevel * 25) +
            Math.sin((x * frequency / 1000) + Date.now() * 0.005) * (8 + resonanceLevel * 15);
          
          if (x === 0) {
            ctx.moveTo(x, waveY);
          } else {
            ctx.lineTo(x, waveY);
          }
        }
        ctx.stroke();
      });
    }

    // Draw particles with enhanced effects
    sortedParticles.forEach(particle => {
      const alpha = 1 - (particle.life / particle.maxLife);
      const color = getEnhancedColor(particle.frequency, particle.discipline, particle.intensity);
      
      // Calculate depth-based scaling
      const depthScale = depthLayers ? (1 + particle.z * 0.005) : 1;
      const size = particle.size * depthScale * (0.5 + alpha * 0.5);

      // Draw trail
      if (!performanceMode && particle.trail.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = size * 0.3;
        ctx.globalAlpha = alpha * 0.6;
        
        ctx.beginPath();
        particle.trail.forEach((point, index) => {
          const trailAlpha = point.alpha * (index / particle.trail.length);
          ctx.globalAlpha = alpha * trailAlpha * 0.4;
          
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      }

      // Draw particle glow
      if (!performanceMode) {
        const glowSize = size * 3;
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, glowSize);
        gradient.addColorStop(0, color + Math.floor(alpha * 100).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw main particle
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Add resonance field effect
      if (resonanceLevel > 0.7 && !performanceMode) {
        const resonanceRadius = size * (2 + resonanceLevel * 3);
        ctx.globalAlpha = alpha * resonanceLevel * 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, resonanceRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    });

    // Draw central resonance field
    if (resonanceLevel > 0.5) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = resonanceLevel * 150;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${resonanceLevel * 0.1})`);
      gradient.addColorStop(0.5, `rgba(128, 200, 255, ${resonanceLevel * 0.05})`);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [activeFrequencies, disciplines, resonanceLevel, getEnhancedColor, performanceMode]);

  // Main animation loop
  useEffect(() => {
    if (!isVisible) return;

    const animate = () => {
      updatePerformanceMode();
      updateEnhancedParticles();
      drawEnhancedVisualization();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, updateEnhancedParticles, drawEnhancedVisualization, updatePerformanceMode]);

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
            {fpsRef.current.toFixed(0)} FPS
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
            <Card className="bg-gray-900/95 backdrop-blur border-gray-700 p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Particle Density */}
                <div>
                  <label className="text-gray-300 mb-1 block">Density: {settings.particleDensity.toFixed(1)}</label>
                  <Slider
                    value={[settings.particleDensity]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, particleDensity: value[0] }))}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* Trail Length */}
                <div>
                  <label className="text-gray-300 mb-1 block">Trails: {settings.trailLength}</label>
                  <Slider
                    value={[settings.trailLength]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, trailLength: value[0] }))}
                    min={0}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Color Mode */}
                <div>
                  <label className="text-gray-300 mb-1 block">Color Mode</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['frequency', 'discipline', 'mixed'] as const).map((mode) => (
                      <Button
                        key={mode}
                        variant={settings.colorMode === mode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSettings(prev => ({ ...prev, colorMode: mode }))}
                        className="text-xs capitalize h-6"
                      >
                        {mode}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
