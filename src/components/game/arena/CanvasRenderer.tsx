
import React, { useRef, useEffect } from 'react';
import { Concept, MouseRef, RotationRef } from './types';
import { hexToRgb, project3DTo2D, rotatePoint } from './utils';

interface CanvasRendererProps {
  concepts: Concept[];
  disciplines: any[];
  isPaused: boolean;
  selectedConcept: string | null;
  rotationRef: React.MutableRefObject<RotationRef>;
  mouseRef: React.MutableRefObject<MouseRef>;
  onConceptClick: (conceptId: string) => void;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  concepts,
  disciplines,
  isPaused,
  selectedConcept,
  rotationRef,
  mouseRef,
  onConceptClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

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
  }, [concepts, disciplines, isPaused, selectedConcept, rotationRef]);

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
        onConceptClick(concept.id);
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    />
  );
};
