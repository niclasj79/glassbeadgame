
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Concept, DimensionalMapping } from './types';
import { useInteractions } from './useInteractions';
import { BackgroundRenderer } from './renderers/BackgroundRenderer';
import { SphereRenderer } from './renderers/SphereRenderer';
import { ConceptRenderer } from './renderers/ConceptRenderer';
import { ConnectionRenderer } from './renderers/ConnectionRenderer';
import { DimensionalRenderer } from './renderers/DimensionalRenderer';
import { ArenaUI } from './ArenaUI';

interface CanvasRendererProps {
  concepts: Concept[];
  disciplines: any[];
  isPaused: boolean;
  selectedConcept: string | null;
  onConceptClick: (conceptId: string) => void;
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void;
  onRotationChange?: (rotationX: number, rotationY: number) => void;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  concepts,
  disciplines,
  isPaused,
  selectedConcept,
  onConceptClick,
  onConceptMove,
  onRotationChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [showDimensionalOverlay, setShowDimensionalOverlay] = useState(true);
  const lastRenderTimeRef = useRef<number>(0);
  const isDirtyRef = useRef<boolean>(true);
  const lastRotationRef = useRef({ x: 0, y: 0 });

  // Updated dimensional mapping to use correct transcendental values
  const dimensionalMapping: DimensionalMapping = {
    x: { positive: "Beautiful", negative: "Ugly", description: "From aesthetic beauty to its negation" },
    y: { positive: "Good", negative: "Evil", description: "From moral goodness to its negation" },
    z: { positive: "True", negative: "False", description: "From truth to its negation" }
  };

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

  // Track rotation changes and notify parent
  useEffect(() => {
    const currentRotation = rotationRef.current;
    const lastRotation = lastRotationRef.current;
    
    if (onRotationChange && 
        (Math.abs(currentRotation.x - lastRotation.x) > 0.01 || 
         Math.abs(currentRotation.y - lastRotation.y) > 0.01)) {
      onRotationChange(currentRotation.x, currentRotation.y);
      lastRotationRef.current = { x: currentRotation.x, y: currentRotation.y };
    }
  });

  // Mark canvas as dirty when concepts change
  useEffect(() => {
    isDirtyRef.current = true;
  }, [concepts, selectedConcept, dragState, showDimensionalOverlay]);

  // Optimized render function with RAF timing
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    
    // Skip render if not enough time has passed (60fps throttling)
    if (!isDirtyRef.current && now - lastRenderTimeRef.current < 16) {
      return;
    }

    // Update canvas size if needed
    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    // Render background
    BackgroundRenderer.render(ctx, canvas);
    
    // Render dimensional grid and axes (if enabled)
    if (showDimensionalOverlay) {
      DimensionalRenderer.render(ctx, canvas, rotationRef, dimensionalMapping);
    }
    
    // Render sphere wireframe
    SphereRenderer.render(ctx, canvas, rotationRef);
    
    // Render connections first (so they appear behind concepts)
    ConnectionRenderer.render(ctx, canvas, concepts, rotationRef);
    
    // Render concepts on top
    ConceptRenderer.render(ctx, canvas, concepts, disciplines, selectedConcept, dragState, rotationRef);

    lastRenderTimeRef.current = now;
    isDirtyRef.current = false;
  }, [concepts, disciplines, selectedConcept, rotationRef, dragState, showDimensionalOverlay, dimensionalMapping]);

  useEffect(() => {
    let isActive = true;

    const animate = () => {
      if (!isActive) return;
      
      if (!isPaused) {
        render();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      isActive = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused, render]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDimensionalOverlay(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="relative w-full h-full">
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
      
      <ArenaUI
        selectedConcept={selectedConcept}
        concepts={concepts}
        dimensionalMapping={dimensionalMapping}
        showDimensionalOverlay={showDimensionalOverlay}
      />
    </div>
  );
};
