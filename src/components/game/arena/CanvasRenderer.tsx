import React, { useRef, useEffect } from 'react';
import { Concept } from './types';
import { hexToRgb, project3DTo2D, rotatePoint } from './utils';
import { useInteractions } from './useInteractions';

interface CanvasRendererProps {
  concepts: Concept[];
  disciplines: any[];
  isPaused: boolean;
  selectedConcept: string | null;
  onConceptClick: (conceptId: string) => void;
  onConceptMove: (conceptId: string, newX: number, newY: number) => void;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  concepts,
  disciplines,
  isPaused,
  selectedConcept,
  onConceptClick,
  onConceptMove
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const {
    rotationRef,
    dragState,
    interactionMode,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getCursor
  } = useInteractions(concepts, onConceptClick, onConceptMove);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const draw = () => {
      // Create a more ethereal background with subtle gradient
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
      );
      gradient.addColorStop(0, 'rgba(5, 5, 25, 0.95)');
      gradient.addColorStop(0.5, 'rgba(10, 5, 35, 0.9)');
      gradient.addColorStop(1, 'rgba(0, 0, 15, 1)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw organic, flowing sphere wireframe
      ctx.strokeStyle = 'rgba(120, 80, 200, 0.15)';
      ctx.lineWidth = 1;
      
      const sphereRadius = 200;
      const segments = 12;
      
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI;
        const y = Math.cos(angle) * sphereRadius;
        const radius = Math.sin(angle) * sphereRadius;
        
        ctx.beginPath();
        for (let j = 0; j <= 48; j++) {
          const a = (j / 48) * Math.PI * 2;
          const variation = Math.sin(a * 3 + angle * 2) * 0.05 + Math.sin(a * 7) * 0.02;
          const adjustedRadius = radius * (1 + variation);
          
          const x = Math.cos(a) * adjustedRadius;
          const z = Math.sin(a) * adjustedRadius;
          
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
      
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        
        ctx.beginPath();
        for (let j = 0; j <= 24; j++) {
          const a = (j / 24) * Math.PI;
          const y = Math.cos(a) * sphereRadius;
          const radius = Math.sin(a) * sphereRadius;
          
          const variation = Math.sin(a * 2 + angle * 3) * 0.03;
          const adjustedRadius = radius * (1 + variation);
          
          const x = Math.cos(angle) * adjustedRadius;
          const z = Math.sin(angle) * adjustedRadius;
          
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

      // Draw concepts with enhanced interaction states
      const sortedConcepts = [...concepts].sort((a, b) => {
        const rotatedA = rotatePoint(a.x, a.y, a.z, rotationRef.current.x, rotationRef.current.y);
        const rotatedB = rotatePoint(b.x, b.y, b.z, rotationRef.current.x, rotationRef.current.y);
        return rotatedB.z - rotatedA.z;
      });

      sortedConcepts.forEach(concept => {
        const discipline = disciplines.find(d => d.id === concept.discipline);
        if (!discipline) return;

        const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
        
        if (projected.scale < 0.3) return;

        // Apply drag offset if this concept is being dragged
        let finalX = projected.x;
        let finalY = projected.y;
        
        if (dragState.isDragging && dragState.conceptId === concept.id) {
          finalX += dragState.offsetX;
          finalY += dragState.offsetY;
        }

        const alpha = Math.max(0.4, projected.scale);
        const baseSize = 6 + concept.energy * 8 * projected.scale;
        const pulseSize = baseSize + Math.sin(Date.now() * 0.003 + concept.energy * 10) * 2;
        
        const rgb = hexToRgb(discipline.color);
        
        // Enhanced glow for dragged concepts
        const isDragged = dragState.isDragging && dragState.conceptId === concept.id;
        const glowMultiplier = isDragged ? 1.5 : 1;
        
        for (let layer = 3; layer >= 0; layer--) {
          const layerAlpha = alpha * (0.3 - layer * 0.05) * glowMultiplier;
          const layerSize = (pulseSize + layer * 8) * (isDragged ? 1.2 : 1);
          
          const gradient = ctx.createRadialGradient(
            finalX, finalY, 0,
            finalX, finalY, layerSize
          );
          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerAlpha})`);
          gradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerAlpha * 0.5})`);
          gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(finalX, finalY, layerSize, 0, Math.PI * 2);
          ctx.fill();
        }

        // Concept core
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(finalX, finalY, pulseSize * 0.3, 0, Math.PI * 2);
        ctx.fill();

        for (let p = 0; p < 3; p++) {
          const particleAngle = (Date.now() * 0.001 + p * 2.1) % (Math.PI * 2);
          const particleRadius = pulseSize + 15 + Math.sin(Date.now() * 0.002 + p) * 5;
          const particleX = finalX + Math.cos(particleAngle) * particleRadius;
          const particleY = finalY + Math.sin(particleAngle) * particleRadius;
          
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(particleX, particleY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Concept text with enhanced styling
        if (projected.scale > 0.6) {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.font = `${Math.floor(14 * projected.scale)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.shadowColor = discipline.color;
          ctx.shadowBlur = 8;
          ctx.fillText(concept.text, finalX, finalY + pulseSize + 20);
          ctx.shadowBlur = 0;
        }

        // Enhanced selection highlight
        if (selectedConcept === concept.id || isDragged) {
          const selectionRadius = pulseSize + 10 + Math.sin(Date.now() * 0.005) * 3;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * (isDragged ? 1 : 0.8)})`;
          ctx.lineWidth = isDragged ? 3 : 2;
          ctx.setLineDash(isDragged ? [8, 4] : [5, 5]);
          ctx.lineDashOffset = Date.now() * 0.01;
          ctx.beginPath();
          ctx.arc(finalX, finalY, selectionRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

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

          const flow = (Date.now() * 0.003) % 1;
          const flowX = projected1.x + (projected2.x - projected1.x) * flow;
          const flowY = projected1.y + (projected2.y - projected1.y) * flow;

          const gradient = ctx.createLinearGradient(projected1.x, projected1.y, projected2.x, projected2.y);
          gradient.addColorStop(0, `rgba(150, 100, 255, ${avgScale * 0.3})`);
          gradient.addColorStop(0.5, `rgba(200, 150, 255, ${avgScale * 0.6})`);
          gradient.addColorStop(1, `rgba(150, 100, 255, ${avgScale * 0.3})`);
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(projected1.x, projected1.y);
          ctx.lineTo(projected2.x, projected2.y);
          ctx.stroke();

          ctx.fillStyle = `rgba(255, 255, 255, ${avgScale * 0.8})`;
          ctx.beginPath();
          ctx.arc(flowX, flowY, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    };

    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [concepts, disciplines, isPaused, selectedConcept, rotationRef, dragState]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};
