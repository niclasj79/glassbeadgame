
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Concept, DimensionalMapping } from './types';
import { useOptimizedInteractions } from './useOptimizedInteractions';
import { BackgroundRenderer } from './renderers/BackgroundRenderer';
import { SphereRenderer } from './renderers/SphereRenderer';
import { ConceptRenderer } from './renderers/ConceptRenderer';
import { ConnectionRenderer } from './renderers/ConnectionRenderer';
import { DimensionalRenderer } from './renderers/DimensionalRenderer';
import { ArenaUI } from './ArenaUI';

interface OptimizedCanvasRendererProps {
  concepts: Concept[];
  disciplines: any[];
  isPaused: boolean;
  selectedConcept: string | null;
  onConceptClick: (conceptId: string) => void;
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void;
}

export const OptimizedCanvasRenderer: React.FC<OptimizedCanvasRendererProps> = ({
  concepts,
  disciplines,
  isPaused,
  selectedConcept,
  onConceptClick,
  onConceptMove
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [showDimensionalOverlay, setShowDimensionalOverlay] = useState(true);
  const lastRenderTimeRef = useRef<number>(0);
  const isDirtyRef = useRef<boolean>(true);
  const renderQueueRef = useRef<Set<string>>(new Set());

  // Performance optimization: memoize dimensional mapping
  const dimensionalMapping: DimensionalMapping = useMemo(() => ({
    x: { positive: "Beautiful", negative: "Ugly", description: "From aesthetic beauty to its negation" },
    y: { positive: "Good", negative: "Evil", description: "From moral goodness to its negation" },
    z: { positive: "True", negative: "False", description: "From truth to its negation" }
  }), []);

  // Performance optimization: memoize discipline lookup
  const disciplineMap = useMemo(() => {
    return disciplines.reduce((map, discipline) => {
      map[discipline.id] = discipline;
      return map;
    }, {} as Record<string, any>);
  }, [disciplines]);

  // Optimized interactions with caching
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
    getCursor,
    clearCaches
  } = useOptimizedInteractions(concepts, onConceptClick, onConceptMove);

  // Clear caches when concepts change significantly
  useEffect(() => {
    clearCaches();
  }, [concepts.length, clearCaches]);

  // Performance optimization: track what needs re-rendering
  useEffect(() => {
    isDirtyRef.current = true;
    
    // Track specific changes for selective rendering
    concepts.forEach(concept => {
      renderQueueRef.current.add(concept.id);
    });
  }, [concepts, selectedConcept, dragState, showDimensionalOverlay]);

  // Highly optimized render function with selective updates
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    
    // Aggressive frame rate limiting (30fps for better performance)
    if (!isDirtyRef.current && now - lastRenderTimeRef.current < 33) {
      return;
    }

    // Performance optimization: only update canvas size when necessary
    const needsResize = canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight;
    if (needsResize) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    // Performance optimization: clear only what's needed
    if (needsResize || renderQueueRef.current.size > concepts.length * 0.5) {
      // Full clear for major changes
      BackgroundRenderer.render(ctx, canvas);
    } else {
      // Partial updates for minor changes
      ctx.globalCompositeOperation = 'destination-over';
      BackgroundRenderer.render(ctx, canvas);
      ctx.globalCompositeOperation = 'source-over';
    }
    
    // Render dimensional grid and axes (cached when possible)
    if (showDimensionalOverlay) {
      DimensionalRenderer.render(ctx, canvas, rotationRef, dimensionalMapping);
    }
    
    // Render sphere wireframe (cached)
    SphereRenderer.render(ctx, canvas, rotationRef);
    
    // Render connections with culling for off-screen elements
    ConnectionRenderer.render(ctx, canvas, concepts, rotationRef);
    
    // Render concepts with optimized discipline lookup
    ConceptRenderer.render(ctx, canvas, concepts, disciplineMap, selectedConcept, dragState, rotationRef);

    lastRenderTimeRef.current = now;
    isDirtyRef.current = false;
    renderQueueRef.current.clear();
  }, [concepts, disciplineMap, selectedConcept, rotationRef, dragState, showDimensionalOverlay, dimensionalMapping]);

  // Optimized animation loop with RAF scheduling
  useEffect(() => {
    let isActive = true;
    let frameCount = 0;

    const animate = () => {
      if (!isActive) return;
      
      frameCount++;
      
      // Adaptive frame rate based on performance
      const shouldRender = !isPaused && (frameCount % 1 === 0); // Can be adjusted based on performance
      
      if (shouldRender) {
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
