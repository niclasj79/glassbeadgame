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
      const segments = 12; // Fewer segments for more organic feel
      
      // Draw flowing latitude lines with subtle variations
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI;
        const y = Math.cos(angle) * sphereRadius;
        const radius = Math.sin(angle) * sphereRadius;
        
        ctx.beginPath();
        for (let j = 0; j <= 48; j++) {
          const a = (j / 48) * Math.PI * 2;
          // Add organic variation to the sphere
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
      
      // Draw flowing longitude lines
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        
        ctx.beginPath();
        for (let j = 0; j <= 24; j++) {
          const a = (j / 24) * Math.PI;
          const y = Math.cos(a) * sphereRadius;
          const radius = Math.sin(a) * sphereRadius;
          
          // Add subtle organic flow
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

      // Draw concepts with more ethereal, organic appearance
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

        const alpha = Math.max(0.4, projected.scale);
        const baseSize = 6 + concept.energy * 8 * projected.scale;
        const pulseSize = baseSize + Math.sin(Date.now() * 0.003 + concept.energy * 10) * 2;
        
        const rgb = hexToRgb(discipline.color);
        
        // Create multiple ethereal glow layers
        for (let layer = 3; layer >= 0; layer--) {
          const layerAlpha = alpha * (0.3 - layer * 0.05);
          const layerSize = pulseSize + layer * 8;
          
          const gradient = ctx.createRadialGradient(
            projected.x, projected.y, 0,
            projected.x, projected.y, layerSize
          );
          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerAlpha})`);
          gradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerAlpha * 0.5})`);
          gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, layerSize, 0, Math.PI * 2);
          ctx.fill();
        }

        // Concept core with organic pulsing
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, pulseSize * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Floating particles around concept
        for (let p = 0; p < 3; p++) {
          const particleAngle = (Date.now() * 0.001 + p * 2.1) % (Math.PI * 2);
          const particleRadius = pulseSize + 15 + Math.sin(Date.now() * 0.002 + p) * 5;
          const particleX = projected.x + Math.cos(particleAngle) * particleRadius;
          const particleY = projected.y + Math.sin(particleAngle) * particleRadius;
          
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(particleX, particleY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Concept text with ethereal styling
        if (projected.scale > 0.6) {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.font = `${Math.floor(14 * projected.scale)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Add subtle text shadow/glow
          ctx.shadowColor = discipline.color;
          ctx.shadowBlur = 8;
          ctx.fillText(concept.text, projected.x, projected.y + pulseSize + 20);
          ctx.shadowBlur = 0;
        }

        // Selection highlight with organic flow
        if (selectedConcept === concept.id) {
          const selectionRadius = pulseSize + 10 + Math.sin(Date.now() * 0.005) * 3;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = Date.now() * 0.01;
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, selectionRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Draw connections with flowing energy
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

          // Flowing energy along connection
          const flow = (Date.now() * 0.003) % 1;
          const flowX = projected1.x + (projected2.x - projected1.x) * flow;
          const flowY = projected1.y + (projected2.y - projected1.y) * flow;

          // Draw connection line with gradient
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

          // Flowing energy particle
          ctx.fillStyle = `rgba(255, 255, 255, ${avgScale * 0.8})`;
          ctx.beginPath();
          ctx.arc(flowX, flowY, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    };

    const animate = () => {
      // Remove automatic rotation - sphere only rotates with user interaction
      draw();
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
