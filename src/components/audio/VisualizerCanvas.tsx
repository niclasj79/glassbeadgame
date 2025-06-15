
import React, { useRef, useCallback } from 'react';

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

interface VisualizerCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  particles: AdvancedParticle[];
  settings: VisualizationSettings;
  activeFrequencies: number[];
  disciplines: string[];
  resonanceLevel: number;
  performanceMode: boolean;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  canvasRef,
  particles,
  settings,
  activeFrequencies,
  disciplines,
  resonanceLevel,
  performanceMode
}) => {
  const disciplineColors = {
    mathematics: { h: 220, s: 70, l: 60 },
    music: { h: 120, s: 70, l: 60 },
    philosophy: { h: 270, s: 70, l: 60 },
    physics: { h: 30, s: 70, l: 60 },
    art: { h: 0, s: 70, l: 60 },
    history: { h: 180, s: 70, l: 60 }
  };

  const getEnhancedColor = useCallback((frequency: number, discipline: string, intensity: number): string => {
    const { colorMode } = settings;
    
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
  }, [settings, resonanceLevel]);

  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { depthLayers } = settings;

    // Clear with dynamic background
    const bgAlpha = performanceMode ? 0.15 : 0.08;
    ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sort particles by depth for proper layering
    const sortedParticles = depthLayers 
      ? [...particles].sort((a, b) => b.z - a.z)
      : particles;

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
  }, [canvasRef, particles, settings, activeFrequencies, disciplines, resonanceLevel, performanceMode, getEnhancedColor]);

  return { drawVisualization };
};
