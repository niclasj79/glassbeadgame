
import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface SynesthesiaVisualizerProps {
  activeFrequencies: number[];
  resonanceLevel: number;
  disciplines: string[];
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  frequency: number;
  discipline: string;
  life: number;
  maxLife: number;
}

export const SynesthesiaVisualizer: React.FC<SynesthesiaVisualizerProps> = ({
  activeFrequencies,
  resonanceLevel,
  disciplines,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const disciplineColors = {
    mathematics: '#3B82F6',
    music: '#10B981',
    philosophy: '#8B5CF6',
    physics: '#F59E0B',
    art: '#EF4444'
  };

  useEffect(() => {
    setIsVisible(activeFrequencies.length > 0);
  }, [activeFrequencies]);

  const frequencyToColor = (frequency: number, discipline: string) => {
    const baseColor = disciplineColors[discipline as keyof typeof disciplineColors] || '#FFFFFF';
    const hue = (frequency / 1000) * 360;
    return `hsl(${hue}, 70%, ${50 + resonanceLevel * 30}%)`;
  };

  const createParticle = (frequency: number, discipline: string): Particle => {
    const canvas = canvasRef.current;
    if (!canvas) return {} as Particle;

    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      frequency,
      discipline,
      life: 0,
      maxLife: 120 + Math.random() * 60
    };
  };

  const updateParticles = () => {
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life += 1;
      
      // Boundary bounce
      const canvas = canvasRef.current;
      if (canvas) {
        if (particle.x <= 0 || particle.x >= canvas.width) particle.vx *= -0.8;
        if (particle.y <= 0 || particle.y >= canvas.height) particle.vy *= -0.8;
        
        particle.x = Math.max(0, Math.min(canvas.width, particle.x));
        particle.y = Math.max(0, Math.min(canvas.height, particle.y));
      }
      
      return particle.life < particle.maxLife;
    });

    // Add new particles based on active frequencies
    activeFrequencies.forEach((frequency, index) => {
      const discipline = disciplines[index % disciplines.length] || 'mathematics';
      if (Math.random() < 0.3) {
        particlesRef.current.push(createParticle(frequency, discipline));
      }
    });
  };

  const drawParticles = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas with slight trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw frequency waves as background
    activeFrequencies.forEach((frequency, index) => {
      const discipline = disciplines[index % disciplines.length] || 'mathematics';
      const color = frequencyToColor(frequency, discipline);
      
      ctx.strokeStyle = color + '30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < canvas.width; x += 5) {
        const y = canvas.height / 2 + Math.sin((x * frequency / 1000) + Date.now() * 0.005) * 
                  (20 + resonanceLevel * 30);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // Draw particles
    particlesRef.current.forEach(particle => {
      const alpha = 1 - (particle.life / particle.maxLife);
      const color = frequencyToColor(particle.frequency, particle.discipline);
      const size = 2 + Math.sin(particle.frequency * 0.01 + Date.now() * 0.01) * 2;
      
      // Particle glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 + resonanceLevel * 10;
      
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowBlur = 0;
    });

    // Draw resonance field
    if (resonanceLevel > 0.5) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = resonanceLevel * 100;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${resonanceLevel * 0.2})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    if (!isVisible) return;

    const animate = () => {
      updateParticles();
      drawParticles();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, activeFrequencies, resonanceLevel, disciplines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
  }, []);

  if (!isVisible) return null;

  return (
    <Card className={`bg-black border-gray-700 overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ minHeight: '200px' }}
      />
    </Card>
  );
};
