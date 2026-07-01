
import { useRef, useCallback } from 'react';

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

interface UseParticleSystemProps {
  settings: VisualizationSettings;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  resonanceLevel: number;
  performanceMode: boolean;
}

export const useParticleSystem = ({
  settings,
  canvasRef,
  resonanceLevel,
  performanceMode
}: UseParticleSystemProps) => {
  const particlesRef = useRef<AdvancedParticle[]>([]);

  const createParticle = useCallback((
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
  }, [canvasRef]);

  const updateParticles = useCallback((
    activeFrequencies: number[],
    disciplines: string[],
    spatialPositions: Array<{ x: number; y: number; z: number; discipline: string; intensity: number }>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { particleDensity, trailLength } = settings;

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
        const scale = 1 + pos.z * 0.01;
        const canvasX = (canvas.width / 2) + pos.x * scale;
        const canvasY = (canvas.height / 2) + pos.y * scale;
        
        particlesRef.current.push(createParticle(frequency, pos.discipline, {
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
        particlesRef.current.push(createParticle(frequency, discipline));
      }
    });

    // Limit particles for performance
    const maxParticles = performanceMode ? 100 : 300;
    if (particlesRef.current.length > maxParticles) {
      particlesRef.current.splice(0, particlesRef.current.length - maxParticles);
    }
  }, [settings, resonanceLevel, createParticle, performanceMode, canvasRef]);

  return {
    particles: particlesRef.current,
    updateParticles
  };
};
