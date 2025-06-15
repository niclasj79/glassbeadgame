
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Concept, DimensionalMapping } from './types';
import { useInteractions } from './useInteractions';
import { useConceptAnimations } from './hooks/useConceptAnimations';
import { useConceptState } from './hooks/useConceptState';
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
  concepts: initialConcepts,
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

  // Concept state management with persistence
  const { concepts, updateConceptPosition, getConceptPosition, updateConcepts } = useConceptState(initialConcepts);
  
  // Animation system
  const { startAnimation, getAnimatedPosition, hasActiveAnimations } = useConceptAnimations();

  // Update concepts when props change
  useEffect(() => {
    updateConcepts(initialConcepts);
  }, [initialConcepts, updateConcepts]);

  // Updated dimensional mapping with corrected labels and swapped Good/Not Good positions
  const dimensionalMapping: DimensionalMapping = {
    x: { positive: "Beautiful", negative: "Not Beautiful", description: "From aesthetic beauty to its negation" },
    y: { positive: "Not Good", negative: "Good", description: "From moral opposition to goodness" },
    z: { positive: "True", negative: "Not True", description: "From truth to its negation" }
  };

  // Enhanced concept move handler with animation
  const handleConceptMoveWithAnimation = useCallback((conceptId: string, newX: number, newY: number, newZ: number) => {
    const currentPosition = getConceptPosition(conceptId);
    if (!currentPosition) return;

    console.log(`Starting animation for concept ${conceptId} from:`, currentPosition, 'to:', { newX, newY, newZ });

    // Start animation from current position to new position
    startAnimation(
      conceptId,
      currentPosition.x,
      currentPosition.y,
      currentPosition.z,
      newX,
      newY,
      newZ,
      600 // 600ms animation duration
    );

    // Update the actual position immediately (the animation will handle the visual transition)
    updateConceptPosition(conceptId, newX, newY, newZ);
    
    // Call the parent callback
    onConceptMove(conceptId, newX, newY, newZ);

    // Dispatch custom events for drag tracking
    window.dispatchEvent(new CustomEvent('conceptdragend'));
  }, [getConceptPosition, startAnimation, updateConceptPosition, onConceptMove]);

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
  } = useInteractions(concepts, onConceptClick, handleConceptMoveWithAnimation);

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

  // Mark canvas as dirty when concepts change or animations are active
  useEffect(() => {
    isDirtyRef.current = true;
  }, [concepts, selectedConcept, dragState, showDimensionalOverlay]);

  // Create animated concepts array for rendering
  const getAnimatedConcepts = useCallback(() => {
    return concepts.map(concept => {
      const animated = getAnimatedPosition(concept.id, concept.x, concept.y, concept.z);
      return {
        ...concept,
        x: animated.x,
        y: animated.y,
        z: animated.z,
        isAnimating: animated.isAnimating
      };
    });
  }, [concepts, getAnimatedPosition]);

  // Optimized render function with animation support
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    
    // Continue rendering during animations, otherwise use normal throttling
    const shouldRender = hasActiveAnimations() || 
                        isDirtyRef.current || 
                        (now - lastRenderTimeRef.current >= 16);
    
    if (!shouldRender) return;

    // Update canvas size if needed
    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    // Get animated concept positions
    const animatedConcepts = getAnimatedConcepts();

    // Render background
    BackgroundRenderer.render(ctx, canvas);
    
    // Render dimensional grid and axes (if enabled)
    if (showDimensionalOverlay) {
      DimensionalRenderer.render(ctx, canvas, rotationRef, dimensionalMapping);
    }
    
    // Render sphere wireframe
    SphereRenderer.render(ctx, canvas, rotationRef);
    
    // Render connections with animated positions
    ConnectionRenderer.render(ctx, canvas, animatedConcepts, rotationRef);
    
    // Render concepts with animations
    ConceptRenderer.render(ctx, canvas, animatedConcepts, disciplines, selectedConcept, dragState, rotationRef);

    lastRenderTimeRef.current = now;
    
    // Only mark as clean if no animations are active
    if (!hasActiveAnimations()) {
      isDirtyRef.current = false;
    }
  }, [concepts, disciplines, selectedConcept, rotationRef, dragState, showDimensionalOverlay, dimensionalMapping, hasActiveAnimations, getAnimatedConcepts]);

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
