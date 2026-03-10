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
import { rotatePoint, project3DTo2D } from './utils';

interface CanvasRendererProps {
  concepts: Concept[];
  disciplines: any[];
  isPaused: boolean;
  selectedConcept: string | null;
  onConceptClick: (conceptId: string) => void;
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void;
  onRotationChange?: (rotationX: number, rotationY: number) => void;
  proximityPairs?: { concept1: Concept; concept2: Concept; proximity: number }[];
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  concepts: initialConcepts,
  disciplines,
  isPaused,
  selectedConcept,
  onConceptClick,
  onConceptMove,
  onRotationChange,
  proximityPairs = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [showDimensionalOverlay, setShowDimensionalOverlay] = useState(false);
  const lastRenderTimeRef = useRef<number>(0);
  const isDirtyRef = useRef<boolean>(true);
  const lastRotationRef = useRef({ x: 0, y: 0 });
  const lastUpdateHashRef = useRef<string>('');
  const internalMoveRef = useRef<Set<string>>(new Set());
  const [hoveredConcept, setHoveredConcept] = useState<string | null>(null);

  // Rotation inertia state
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPointerMoveRef = useRef({ x: 0, y: 0, time: 0 });
  const inertiaAnimRef = useRef<number>();

  const { concepts, updateConceptPosition, getConceptPosition, updateConcepts } = useConceptState(initialConcepts);
  const { startAnimation, getAnimatedPosition, hasActiveAnimations } = useConceptAnimations();

  const createConceptHash = useCallback((conceptList: Concept[]) => {
    return conceptList.map(c => `${c.id}:${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`).join('|');
  }, []);

  useEffect(() => {
    const newHash = createConceptHash(initialConcepts);
    if (newHash === lastUpdateHashRef.current || internalMoveRef.current.size > 0) return;

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
      updateConcepts(initialConcepts);
      lastUpdateHashRef.current = newHash;
    }
  }, [initialConcepts, createConceptHash, getConceptPosition, updateConcepts]);

  const dimensionalMapping: DimensionalMapping = {
    x: { positive: "Beautiful", negative: "Not Beautiful", description: "From aesthetic beauty to its negation" },
    y: { positive: "Not Good", negative: "Good", description: "From moral opposition to goodness" },
    z: { positive: "True", negative: "Not True", description: "From truth to its negation" }
  };

  const handleConceptMoveWithAnimation = useCallback((conceptId: string, newX: number, newY: number, newZ: number) => {
    const currentPosition = getConceptPosition(conceptId);
    if (!currentPosition) return;

    internalMoveRef.current.add(conceptId);

    startAnimation(conceptId, currentPosition.x, currentPosition.y, currentPosition.z, newX, newY, newZ, 600);
    updateConceptPosition(conceptId, newX, newY, newZ);
    onConceptMove(conceptId, newX, newY, newZ);

    setTimeout(() => {
      internalMoveRef.current.delete(conceptId);
    }, 100);

    window.dispatchEvent(new CustomEvent('conceptdragend'));
  }, [getConceptPosition, startAnimation, updateConceptPosition, onConceptMove]);

  const {
    rotationRef, dragState, interactionMode,
    handleMouseDown, handleMouseMove, handleMouseUp,
    handleTouchStart, handleTouchMove, handleTouchEnd,
    getCursor
  } = useInteractions(concepts, onConceptClick, handleConceptMoveWithAnimation);

  // Track pointer velocity for inertia
  const wrappedMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const now = performance.now();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Track velocity while rotating
    if (interactionMode === 'rotating') {
      const dt = now - lastPointerMoveRef.current.time;
      if (dt > 0 && dt < 100) {
        velocityRef.current = {
          x: (y - lastPointerMoveRef.current.y) * 0.01 / (dt / 16),
          y: (x - lastPointerMoveRef.current.x) * 0.01 / (dt / 16)
        };
      }
    }
    lastPointerMoveRef.current = { x, y, time: now };

    // Hover detection
    const canvas = canvasRef.current;
    if (canvas && !dragState.isDragging && interactionMode === 'idle') {
      let found: string | null = null;
      for (const concept of concepts) {
        const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
        const dist = Math.sqrt((x - projected.x) ** 2 + (y - projected.y) ** 2);
        const size = 18 + concept.energy * 12 * projected.scale;
        if (dist < size + 10) {
          found = concept.id;
          break;
        }
      }
      if (found !== hoveredConcept) setHoveredConcept(found);
    }

    handleMouseMove(e);
  }, [handleMouseMove, interactionMode, concepts, rotationRef, dragState, hoveredConcept]);

  // Apply inertia on mouse up
  const wrappedMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (interactionMode === 'rotating') {
      const vel = velocityRef.current;
      if (Math.abs(vel.x) > 0.001 || Math.abs(vel.y) > 0.001) {
        // Start inertia loop
        const applyInertia = () => {
          velocityRef.current.x *= 0.95;
          velocityRef.current.y *= 0.95;
          rotationRef.current.x += velocityRef.current.x;
          rotationRef.current.y += velocityRef.current.y;
          isDirtyRef.current = true;

          if (Math.abs(velocityRef.current.x) > 0.0005 || Math.abs(velocityRef.current.y) > 0.0005) {
            inertiaAnimRef.current = requestAnimationFrame(applyInertia);
          }
        };
        if (inertiaAnimRef.current) cancelAnimationFrame(inertiaAnimRef.current);
        inertiaAnimRef.current = requestAnimationFrame(applyInertia);
      }
    }
    handleMouseUp(e);
  }, [handleMouseUp, interactionMode, rotationRef]);

  // Stop inertia on new mouseDown
  const wrappedMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (inertiaAnimRef.current) {
      cancelAnimationFrame(inertiaAnimRef.current);
      velocityRef.current = { x: 0, y: 0 };
    }
    handleMouseDown(e);
  }, [handleMouseDown]);

  // Scroll wheel = X-axis tilt
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    rotationRef.current.x += e.deltaY * 0.002;
    isDirtyRef.current = true;
  }, [rotationRef]);

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

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      isDirtyRef.current = true;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    handleResize();
    return () => resizeObserver.disconnect();
  }, [handleResize]);

  useEffect(() => {
    isDirtyRef.current = true;
  }, [concepts, selectedConcept, dragState, showDimensionalOverlay, proximityPairs, hoveredConcept]);

  const getAnimatedConcepts = useCallback(() => {
    return concepts.map(concept => {
      const animated = getAnimatedPosition(concept.id, concept.x, concept.y, concept.z);
      return { ...concept, x: animated.x, y: animated.y, z: animated.z, isAnimating: animated.isAnimating };
    });
  }, [concepts, getAnimatedPosition]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const shouldRender = hasActiveAnimations() || isDirtyRef.current || (now - lastRenderTimeRef.current >= 16);
    if (!shouldRender) return;

    const animatedConcepts = getAnimatedConcepts();

    BackgroundRenderer.render(ctx, canvas);
    if (showDimensionalOverlay) {
      DimensionalRenderer.render(ctx, canvas, rotationRef, dimensionalMapping);
    }
    SphereRenderer.render(ctx, canvas, rotationRef);
    ConnectionRenderer.render(ctx, canvas, animatedConcepts, rotationRef, disciplines);

    // Proximity bridges
    for (const pair of proximityPairs) {
      const d1 = Array.isArray(disciplines) ? disciplines.find(d => d.id === pair.concept1.discipline) : null;
      const d2 = Array.isArray(disciplines) ? disciplines.find(d => d.id === pair.concept2.discipline) : null;
      if (d1 && d2) {
        ConnectionRenderer.renderProximityBridge(
          ctx, canvas, pair.concept1, pair.concept2,
          pair.proximity, d1.color, d2.color, rotationRef
        );
      }
    }

    ConceptRenderer.render(ctx, canvas, animatedConcepts, disciplines, selectedConcept, dragState, rotationRef, hoveredConcept);

    lastRenderTimeRef.current = now;
    if (!hasActiveAnimations()) isDirtyRef.current = false;
  }, [concepts, disciplines, selectedConcept, rotationRef, dragState, showDimensionalOverlay, dimensionalMapping, hasActiveAnimations, getAnimatedConcepts, proximityPairs, hoveredConcept]);

  useEffect(() => {
    let isActive = true;
    const animate = () => {
      if (!isActive) return;
      if (!isPaused) render();
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      isActive = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (inertiaAnimRef.current) cancelAnimationFrame(inertiaAnimRef.current);
    };
  }, [isPaused, render]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setShowDimensionalOverlay(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: hoveredConcept ? 'pointer' : getCursor() }}
        onMouseDown={wrappedMouseDown}
        onMouseMove={wrappedMouseMove}
        onMouseUp={wrappedMouseUp}
        onMouseLeave={wrappedMouseUp}
        onWheel={handleWheel}
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
