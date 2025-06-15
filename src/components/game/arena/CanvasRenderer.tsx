
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
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [showDimensionalOverlay, setShowDimensionalOverlay] = useState(true);
  const lastRenderTimeRef = useRef<number>(0);
  const isDirtyRef = useRef<boolean>(true);
  const lastRotationRef = useRef({ x: 0, y: 0 });
  const lastUpdateHashRef = useRef<string>('');
  const internalMoveRef = useRef<Set<string>>(new Set());

  // Concept state management with persistence
  const { concepts, updateConceptPosition, getConceptPosition, updateConcepts } = useConceptState(initialConcepts);
  
  // Animation system
  const { startAnimation, getAnimatedPosition, hasActiveAnimations } = useConceptAnimations();

  // Create a hash of concept positions to detect external vs internal changes
  const createConceptHash = useCallback((conceptList: Concept[]) => {
    return conceptList.map(c => `${c.id}:${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`).join('|');
  }, []);

  // Smart concept update - only update if changes are from external source
  useEffect(() => {
    const newHash = createConceptHash(initialConcepts);
    
    // Skip update if hash hasn't changed or if we have pending internal moves
    if (newHash === lastUpdateHashRef.current || internalMoveRef.current.size > 0) {
      return;
    }

    // Check if this is an external update by comparing individual concept positions
    let hasExternalChanges = false;
    for (const newConcept of initialConcepts) {
      const currentPosition = getConceptPosition(newConcept.id);
      if (!currentPosition || 
          Math.abs(currentPosition.x - newConcept.x) > 0.01 ||
          Math.abs(currentPosition.y - newConcept.y) > 0.01 ||
          Math.abs(currentPosition.z - newConcept.z) > 0.01) {
        hasExternalChanges = true;
        break;
      }
    }

    if (hasExternalChanges) {
      console.log('External concept position changes detected, updating internal state');
      updateConcepts(initialConcepts);
      lastUpdateHashRef.current = newHash;
    }
  }, [initialConcepts, createConceptHash, getConceptPosition, updateConcepts]);

  // Updated dimensional mapping with corrected labels and swapped Good/Not Good positions
  const dimensionalMapping: DimensionalMapping = {
    x: { positive: "Beautiful", negative: "Not Beautiful", description: "From aesthetic beauty to its negation" },
    y: { positive: "Not Good", negative: "Good", description: "From moral opposition to goodness" },
    z: { positive: "True", negative: "Not True", description: "From truth to its negation" }
  };

  // Enhanced concept move handler with proper state management
  const handleConceptMoveWithAnimation = useCallback((conceptId: string, newX: number, newY: number, newZ: number) => {
    const currentPosition = getConceptPosition(conceptId);
    if (!currentPosition) return;

    console.log(`Handling concept move for ${conceptId} from:`, currentPosition, 'to:', { newX, newY, newZ });

    // Mark this as an internal move to prevent external updates from overriding
    internalMoveRef.current.add(conceptId);

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

    // Update the internal state immediately
    updateConceptPosition(conceptId, newX, newY, newZ);
    
    // Call the parent callback to update the session state
    onConceptMove(conceptId, newX, newY, newZ);

    // Clear the internal move flag after a short delay to allow parent updates to complete
    setTimeout(() => {
      internalMoveRef.current.delete(conceptId);
      console.log(`Cleared internal move flag for ${conceptId}`);
    }, 100);

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

  // Canvas resize handler with proper container sizing
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Get the actual container dimensions
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Only resize if dimensions actually changed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      isDirtyRef.current = true;
      console.log(`Canvas resized to ${width}x${height}`);
    }
  }, []);

  // Set up resize observer for proper canvas sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(container);
    
    // Initial resize
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize]);

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
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
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
