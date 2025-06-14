import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAudio } from '../audio/AudioEngine';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface SphericalArenaProps {
  disciplines: any[];
  selectedDisciplines: string[];
  concepts: Concept[];
  onConceptInteraction: (conceptId: string, action: string) => void;
  onSessionEnd: () => void;
}

interface Concept {
  id: string;
  text: string;
  discipline: string;
  x: number;
  y: number;
  z: number;
  energy: number;
  connections: string[];
}

// Helper function to convert hex color to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const SphericalArena: React.FC<SphericalArenaProps> = ({
  disciplines,
  selectedDisciplines,
  concepts,
  onConceptInteraction,
  onSessionEnd
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const rotationRef = useRef({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  
  const { playDisciplineSound, playSynthesisSound } = useAudio();

  // Project 3D point to 2D canvas
  const project3DTo2D = (x: number, y: number, z: number, canvas: HTMLCanvasElement) => {
    const distance = 400;
    const scale = distance / (distance + z);
    return {
      x: (x * scale) + canvas.width / 2,
      y: (y * scale) + canvas.height / 2,
      scale
    };
  };

  // Rotate point around origin
  const rotatePoint = (x: number, y: number, z: number, rotX: number, rotY: number) => {
    // Rotate around Y axis
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const newX = x * cosY - z * sinY;
    const newZ = x * sinY + z * cosY;
    
    // Rotate around X axis
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const newY = y * cosX - newZ * sinX;
    const finalZ = y * sinX + newZ * cosX;
    
    return { x: newX, y: newY, z: finalZ };
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPaused) {
        setSessionTime(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 20, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw sphere wireframe
      ctx.strokeStyle = 'rgba(100, 100, 255, 0.2)';
      ctx.lineWidth = 1;
      
      const sphereRadius = 200;
      const segments = 16;
      
      // Draw latitude lines
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI;
        const y = Math.cos(angle) * sphereRadius;
        const radius = Math.sin(angle) * sphereRadius;
        
        ctx.beginPath();
        for (let j = 0; j <= 64; j++) {
          const a = (j / 64) * Math.PI * 2;
          const x = Math.cos(a) * radius;
          const z = Math.sin(a) * radius;
          
          const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
          const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
          
          if (j === 0) {
            ctx.moveTo(projected.x, projected.y);
          } else {
            ctx.lineTo(projected.x, projected.y);
          }
        }
        ctx.stroke();
      }
      
      // Draw longitude lines
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        
        ctx.beginPath();
        for (let j = 0; j <= 32; j++) {
          const a = (j / 32) * Math.PI;
          const y = Math.cos(a) * sphereRadius;
          const radius = Math.sin(a) * sphereRadius;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          
          const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
          const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
          
          if (j === 0) {
            ctx.moveTo(projected.x, projected.y);
          } else {
            ctx.lineTo(projected.x, projected.y);
          }
        }
        ctx.stroke();
      }

      // Draw concepts
      const sortedConcepts = [...concepts].sort((a, b) => {
        const rotatedA = rotatePoint(a.x, a.y, a.z, rotationRef.current.x, rotationRef.current.y);
        const rotatedB = rotatePoint(b.x, b.y, b.z, rotationRef.current.x, rotationRef.current.y);
        return rotatedB.z - rotatedA.z; // Draw far objects first
      });

      sortedConcepts.forEach(concept => {
        const discipline = disciplines.find(d => d.id === concept.discipline);
        if (!discipline) return;

        const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
        
        if (projected.scale < 0.3) return; // Don't draw if too far

        const alpha = Math.max(0.3, projected.scale);
        const size = 8 + concept.energy * 4 * projected.scale;
        
        // Convert hex color to RGB for proper alpha handling
        const rgb = hexToRgb(discipline.color);
        
        // Concept glow
        const gradient = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, size * 2);
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Concept core
        ctx.fillStyle = discipline.color;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Concept text
        if (projected.scale > 0.6) {
          ctx.fillStyle = 'white';
          ctx.font = `${Math.floor(12 * projected.scale)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(concept.text, projected.x, projected.y + size + 15);
        }

        // Selection highlight
        if (selectedConcept === concept.id) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, size + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Draw connections
      concepts.forEach(concept => {
        concept.connections.forEach(connectionId => {
          const connectedConcept = concepts.find(c => c.id === connectionId);
          if (!connectedConcept) return;

          const rotated1 = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
          const rotated2 = rotatePoint(connectedConcept.x, connectedConcept.y, connectedConcept.z, rotationRef.current.x, rotationRef.current.y);
          
          const projected1 = project3DTo2D(rotated1.x, rotated1.y, rotated1.z, canvas);
          const projected2 = project3DTo2D(rotated2.x, rotated2.y, rotated2.z, canvas);

          const avgScale = (projected1.scale + projected2.scale) / 2;
          if (avgScale < 0.3) return;

          ctx.strokeStyle = `rgba(255, 255, 255, ${avgScale * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(projected1.x, projected1.y);
          ctx.lineTo(projected2.x, projected2.y);
          ctx.stroke();
        });
      });
    };

    const animate = () => {
      if (!isPaused) {
        // Auto-rotate slowly
        rotationRef.current.y += 0.002;
        draw();
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [concepts, disciplines, isPaused, selectedConcept]);

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseRef.current.isDown = true;
    mouseRef.current.x = e.clientX;
    mouseRef.current.y = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.isDown) return;

    const deltaX = e.clientX - mouseRef.current.x;
    const deltaY = e.clientY - mouseRef.current.y;

    rotationRef.current.x += deltaY * 0.01;
    rotationRef.current.y += deltaX * 0.01;

    mouseRef.current.x = e.clientX;
    mouseRef.current.y = e.clientY;
  };

  const handleMouseUp = () => {
    mouseRef.current.isDown = false;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find clicked concept
    for (const concept of concepts) {
      const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
      const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
      
      const distance = Math.sqrt((x - projected.x) ** 2 + (y - projected.y) ** 2);
      const size = 8 + concept.energy * 4 * projected.scale;
      
      if (distance < size + 5) {
        setSelectedConcept(concept.id);
        onConceptInteraction(concept.id, 'select');
        
        const discipline = disciplines.find(d => d.id === concept.discipline);
        if (discipline) {
          playDisciplineSound(concept.discipline, concept.energy);
        }
        return;
      }
    }
    
    setSelectedConcept(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-black">
      {/* Header Controls */}
      <div className="flex justify-between items-center p-4 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-blue-400 text-blue-400">
            {formatTime(sessionTime)}
          </Badge>
          <Badge variant="outline" className="border-green-400 text-green-400">
            {concepts.length} Concepts Active
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsPaused(!isPaused)}
            className="border-purple-400 text-purple-400"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              rotationRef.current = { x: 0, y: 0 };
            }}
            className="border-gray-400 text-gray-400"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            onClick={onSessionEnd}
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            End Session
          </Button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        />
        
        {selectedConcept && (
          <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg border border-gray-600 max-w-xs">
            <h4 className="font-semibold mb-2">Selected Concept</h4>
            <p className="text-sm text-gray-300">
              {concepts.find(c => c.id === selectedConcept)?.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
