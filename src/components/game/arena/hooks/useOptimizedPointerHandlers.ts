
import { useCallback, useRef } from 'react';
import { Concept, RotationRef, MouseRef, DragState, InteractionMode } from '../types';
import { rotatePoint, project3DTo2D, screenToSphere, screenToXY } from '../utils';

export const useOptimizedPointerHandlers = (
  concepts: Concept[],
  onConceptClick: (conceptId: string) => void,
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void
) => {
  // Optimized caching system
  const projectionCacheRef = useRef<Map<string, { x: number; y: number; scale: number; timestamp: number }>>(new Map());
  const hitTestCacheRef = useRef<Map<string, { conceptId: string | null; timestamp: number }>>(new Map());
  
  const CACHE_DURATION = 32; // Increased cache duration to 32ms (~30fps)
  const HIT_TEST_CACHE_DURATION = 16; // Cache hit tests for 16ms
  const DRAG_THROTTLE = 16; // Throttle drag updates to ~60fps
  const lastDragUpdateRef = useRef<number>(0);

  // Highly optimized projection with longer cache duration
  const getCachedProjection = useCallback((concept: Concept, rotationRef: React.MutableRefObject<RotationRef>, canvas: HTMLCanvasElement) => {
    const now = Date.now();
    const cacheKey = `${concept.id}-${Math.round(rotationRef.current.x * 100)}-${Math.round(rotationRef.current.y * 100)}`;
    const cached = projectionCacheRef.current.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached;
    }

    const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
    const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
    
    const result = { ...projected, timestamp: now };
    projectionCacheRef.current.set(cacheKey, result);
    
    // Efficient cache cleanup
    if (projectionCacheRef.current.size > 30) {
      const entries = Array.from(projectionCacheRef.current.entries());
      const toDelete = entries.slice(0, 10); // Remove oldest 10 entries
      toDelete.forEach(([key]) => projectionCacheRef.current.delete(key));
    }
    
    return result;
  }, []);

  // Optimized hit testing with caching
  const findConceptAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<RotationRef>) => {
    const now = Date.now();
    const hitCacheKey = `${Math.round(x/5)}-${Math.round(y/5)}`; // Grid-based caching
    const cached = hitTestCacheRef.current.get(hitCacheKey);
    
    if (cached && (now - cached.timestamp) < HIT_TEST_CACHE_DURATION) {
      if (cached.conceptId) {
        const concept = concepts.find(c => c.id === cached.conceptId);
        if (concept) {
          const projected = getCachedProjection(concept, rotationRef, canvas);
          return { concept, projected };
        }
      }
      return null;
    }

    // Perform actual hit test - optimize by testing closest concepts first
    const conceptsWithDistance = concepts.map(concept => {
      const projected = getCachedProjection(concept, rotationRef, canvas);
      const distance = Math.sqrt((x - projected.x) ** 2 + (y - projected.y) ** 2);
      return { concept, projected, distance };
    }).sort((a, b) => a.distance - b.distance);

    for (const { concept, projected, distance } of conceptsWithDistance) {
      const baseSize = 8 + concept.energy * 4 * projected.scale;
      const touchSize = Math.max(baseSize + 15, 30);
      
      if (distance < touchSize) {
        hitTestCacheRef.current.set(hitCacheKey, { conceptId: concept.id, timestamp: now });
        return { concept, projected };
      }
    }

    hitTestCacheRef.current.set(hitCacheKey, { conceptId: null, timestamp: now });
    return null;
  }, [concepts, getCachedProjection]);

  const handlePointerDown = useCallback((
    x: number, 
    y: number, 
    canvas: HTMLCanvasElement, 
    rotationRef: React.MutableRefObject<RotationRef>,
    mouseRef: React.MutableRefObject<MouseRef>,
    setInteractionMode: (mode: InteractionMode) => void,
    setDragState: (state: DragState | ((prev: DragState) => DragState)) => void,
    dragTimeoutRef: React.MutableRefObject<number | undefined>,
    touchId?: number
  ) => {
    // Handle multi-touch rotation
    if (mouseRef.current.activeTouches.length >= 2) {
      mouseRef.current.twoFingerRotation = true;
      setInteractionMode('two-finger-rotating');
      return;
    }

    mouseRef.current = { 
      ...mouseRef.current,
      x, 
      y, 
      isDown: true, 
      touchId,
      twoFingerRotation: false
    };
    
    const conceptHit = findConceptAtPosition(x, y, canvas, rotationRef);
    
    if (conceptHit) {
      setInteractionMode('selecting');
      
      // Faster drag initiation for better responsiveness
      const dragDelay = touchId !== undefined ? 30 : 80; // Reduced delays
      
      dragTimeoutRef.current = window.setTimeout(() => {
        if (mouseRef.current.isDown) {
          setInteractionMode('dragging');
          setDragState({
            isDragging: true,
            conceptId: conceptHit.concept.id,
            startX: x,
            startY: y,
            offsetX: 0,
            offsetY: 0,
            touchDragMode: touchId !== undefined
          });
        }
      }, dragDelay);
    } else {
      // Empty space interaction
      if (touchId === undefined) {
        setInteractionMode('rotating');
      } else {
        setInteractionMode('selecting');
      }
    }
  }, [findConceptAtPosition]);

  const handlePointerMove = useCallback((
    x: number, 
    y: number, 
    canvas: HTMLCanvasElement,
    rotationRef: React.MutableRefObject<RotationRef>,
    mouseRef: React.MutableRefObject<MouseRef>,
    interactionMode: InteractionMode,
    dragState: DragState,
    setInteractionMode: (mode: InteractionMode) => void,
    setDragState: (state: DragState | ((prev: DragState) => DragState)) => void,
    dragTimeoutRef: React.MutableRefObject<number | undefined>
  ) => {
    if (!mouseRef.current.isDown && interactionMode !== 'two-finger-rotating') return;

    const now = Date.now();
    const deltaX = x - mouseRef.current.x;
    const deltaY = y - mouseRef.current.y;

    if (interactionMode === 'rotating' || interactionMode === 'two-finger-rotating') {
      // Optimized rotation with reduced sensitivity
      rotationRef.current.x += deltaY * 0.006; // Reduced from 0.008
      rotationRef.current.y += deltaX * 0.006;
      
      if (interactionMode !== 'two-finger-rotating') {
        mouseRef.current.x = x;
        mouseRef.current.y = y;
      }
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      // Throttle drag updates for performance
      if (now - lastDragUpdateRef.current < DRAG_THROTTLE) {
        return;
      }
      lastDragUpdateRef.current = now;

      // Optimized coordinate calculation
      if (dragState.touchDragMode) {
        // Touch drag - faster XY calculation
        const xyPos = screenToXY(x, y, canvas, rotationRef);
        setDragState(prev => ({
          ...prev,
          offsetX: x - prev.startX,
          offsetY: y - prev.startY,
          sphereX: xyPos.x,
          sphereY: xyPos.y,
          sphereZ: 0
        }));
      } else {
        // Mouse drag - full 3D but cached
        const spherePos = screenToSphere(x, y, canvas, rotationRef);
        setDragState(prev => ({
          ...prev,
          offsetX: x - prev.startX,
          offsetY: y - prev.startY,
          sphereX: spherePos.x,
          sphereY: spherePos.y,
          sphereZ: spherePos.z
        }));
      }
    } else if (interactionMode === 'selecting') {
      const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const threshold = mouseRef.current.touchId !== undefined ? 20 : 6;
      
      if (moveDistance > threshold) {
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
        
        if (mouseRef.current.touchId === undefined) {
          setInteractionMode('rotating');
          rotationRef.current.x += deltaY * 0.006;
          rotationRef.current.y += deltaX * 0.006;
          mouseRef.current.x = x;
          mouseRef.current.y = y;
        }
      }
    }
  }, []);

  const handlePointerUp = useCallback((
    x: number, 
    y: number, 
    canvas: HTMLCanvasElement,
    rotationRef: React.MutableRefObject<RotationRef>,
    mouseRef: React.MutableRefObject<MouseRef>,
    interactionMode: InteractionMode,
    dragState: DragState,
    setInteractionMode: (mode: InteractionMode) => void,
    setDragState: (state: DragState | ((prev: DragState) => DragState)) => void,
    dragTimeoutRef: React.MutableRefObject<number | undefined>
  ) => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    if (interactionMode === 'selecting') {
      const conceptHit = findConceptAtPosition(x, y, canvas, rotationRef);
      if (conceptHit) {
        onConceptClick(conceptHit.concept.id);
      }
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      // Single update at the end of drag
      if (dragState.touchDragMode) {
        const currentConcept = concepts.find(c => c.id === dragState.conceptId);
        if (currentConcept && dragState.sphereX !== undefined && dragState.sphereY !== undefined) {
          onConceptMove(dragState.conceptId, dragState.sphereX, dragState.sphereY, currentConcept.z);
        }
      } else {
        if (dragState.sphereX !== undefined && dragState.sphereY !== undefined && dragState.sphereZ !== undefined) {
          onConceptMove(dragState.conceptId, dragState.sphereX, dragState.sphereY, dragState.sphereZ);
        }
      }
    }

    // Reset state
    if (interactionMode !== 'two-finger-rotating') {
      mouseRef.current.isDown = false;
    }
    mouseRef.current.twoFingerRotation = false;
    setInteractionMode('idle');
    setDragState({
      isDragging: false,
      conceptId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      touchDragMode: false
    });
  }, [concepts, findConceptAtPosition, onConceptClick, onConceptMove]);

  // Clear caches when concepts change significantly
  const clearCaches = useCallback(() => {
    projectionCacheRef.current.clear();
    hitTestCacheRef.current.clear();
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearCaches
  };
};
