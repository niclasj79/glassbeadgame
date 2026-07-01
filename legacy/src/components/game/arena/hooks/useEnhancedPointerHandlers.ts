
import { useCallback, useRef } from 'react';
import { Concept, RotationRef, MouseRef, DragState, InteractionMode } from '../types';
import { rotatePoint, project3DTo2D, screenToSphere, screenToXY } from '../utils';
import { useImprovedTouch } from '../../../../hooks/useImprovedTouch';
import { useAccessibility } from '../../../../hooks/useAccessibility';

export const useEnhancedPointerHandlers = (
  concepts: Concept[],
  onConceptClick: (conceptId: string) => void,
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void
) => {
  const { announce } = useAccessibility();
  
  // Enhanced caching with better performance
  const projectionCacheRef = useRef<Map<string, { x: number; y: number; scale: number; timestamp: number }>>(new Map());
  const hitTestCacheRef = useRef<Map<string, { conceptId: string | null; timestamp: number }>>(new Map());
  
  const CACHE_DURATION = 50; // Longer cache for better performance
  const HIT_TEST_CACHE_DURATION = 32;
  const DRAG_THROTTLE = 16; // 60fps throttling
  const lastDragUpdateRef = useRef<number>(0);

  // Enhanced touch gesture handling
  const { touchState } = useImprovedTouch((gesture) => {
    switch (gesture.type) {
      case 'long-press':
        announce('Long press detected - accessing concept details');
        break;
      case 'double-tap':
        announce('Double tap - resetting view');
        break;
      case 'pinch':
        if (gesture.scale && gesture.scale > 1.1) {
          announce('Zooming in');
        } else if (gesture.scale && gesture.scale < 0.9) {
          announce('Zooming out');
        }
        break;
    }
  }, {
    enablePinch: true,
    enableRotation: true,
    longPressDelay: 300 // Faster response
  });

  // Optimized projection with accessibility
  const getCachedProjection = useCallback((concept: Concept, rotationRef: React.MutableRefObject<RotationRef>, canvas: HTMLCanvasElement) => {
    const now = Date.now();
    const cacheKey = `${concept.id}-${Math.round(rotationRef.current.x * 50)}-${Math.round(rotationRef.current.y * 50)}`;
    const cached = projectionCacheRef.current.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached;
    }

    const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
    const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
    
    const result = { ...projected, timestamp: now };
    projectionCacheRef.current.set(cacheKey, result);
    
    // Efficient cache cleanup
    if (projectionCacheRef.current.size > 25) {
      const entries = Array.from(projectionCacheRef.current.entries());
      const toDelete = entries.slice(0, 5);
      toDelete.forEach(([key]) => projectionCacheRef.current.delete(key));
    }
    
    return result;
  }, []);

  // Enhanced hit testing with accessibility feedback
  const findConceptAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<RotationRef>) => {
    const now = Date.now();
    const hitCacheKey = `${Math.round(x/8)}-${Math.round(y/8)}`;
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

    // Optimized hit test with larger touch targets
    const conceptsWithDistance = concepts.map(concept => {
      const projected = getCachedProjection(concept, rotationRef, canvas);
      const distance = Math.sqrt((x - projected.x) ** 2 + (y - projected.y) ** 2);
      return { concept, projected, distance };
    }).sort((a, b) => a.distance - b.distance);

    for (const { concept, projected, distance } of conceptsWithDistance) {
      const baseSize = 8 + concept.energy * 4 * projected.scale;
      // Enhanced touch targets based on device type
      const touchMultiplier = touchState.isTouch ? 2.5 : 1.5;
      const touchSize = Math.max(baseSize * touchMultiplier, touchState.isTouch ? 44 : 24);
      
      if (distance < touchSize) {
        hitTestCacheRef.current.set(hitCacheKey, { conceptId: concept.id, timestamp: now });
        return { concept, projected };
      }
    }

    hitTestCacheRef.current.set(hitCacheKey, { conceptId: null, timestamp: now });
    return null;
  }, [concepts, getCachedProjection, touchState.isTouch]);

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
    // Enhanced multi-touch handling
    if (mouseRef.current.activeTouches.length >= 2) {
      mouseRef.current.twoFingerRotation = true;
      setInteractionMode('two-finger-rotating');
      announce('Two finger rotation mode');
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
      
      // Announce concept hover for accessibility
      announce(`Concept detected: ${conceptHit.concept.text}`);
      
      // Adaptive timing based on device and interaction type
      const dragDelay = touchId !== undefined ? 
        (touchState.gestureType === 'long-press' ? 50 : 200) : // Faster for long press
        100;
      
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
          announce(`Dragging concept: ${conceptHit.concept.text}`);
        }
      }, dragDelay);
    } else {
      if (touchId === undefined) {
        setInteractionMode('rotating');
        announce('Rotation mode');
      } else {
        setInteractionMode('selecting');
      }
    }
  }, [findConceptAtPosition, announce, touchState.gestureType]);

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
      // Adaptive rotation sensitivity
      const sensitivity = touchState.isTouch ? 0.004 : 0.006;
      rotationRef.current.x += deltaY * sensitivity;
      rotationRef.current.y += deltaX * sensitivity;
      
      if (interactionMode !== 'two-finger-rotating') {
        mouseRef.current.x = x;
        mouseRef.current.y = y;
      }
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      // Enhanced drag throttling with performance monitoring
      if (now - lastDragUpdateRef.current < DRAG_THROTTLE) {
        return;
      }
      lastDragUpdateRef.current = now;

      // Optimized coordinate calculation based on interaction type
      if (dragState.touchDragMode) {
        // Touch drag - optimized XY calculation
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
        // Mouse drag - full 3D positioning
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
      const threshold = mouseRef.current.touchId !== undefined ? 15 : 5;
      
      if (moveDistance > threshold) {
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
        
        if (mouseRef.current.touchId === undefined) {
          setInteractionMode('rotating');
          const sensitivity = 0.006;
          rotationRef.current.x += deltaY * sensitivity;
          rotationRef.current.y += deltaX * sensitivity;
          mouseRef.current.x = x;
          mouseRef.current.y = y;
        }
      }
    }
  }, [touchState.isTouch]);

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
        announce(`Activating concept: ${conceptHit.concept.text}`);
        onConceptClick(conceptHit.concept.id);
      }
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      // Enhanced drag completion with accessibility feedback
      const concept = concepts.find(c => c.id === dragState.conceptId);
      if (concept) {
        announce(`Concept ${concept.text} moved to new position`);
      }
      
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
  }, [concepts, findConceptAtPosition, onConceptClick, onConceptMove, announce]);

  // Clear caches when concepts change significantly
  const clearCaches = useCallback(() => {
    projectionCacheRef.current.clear();
    hitTestCacheRef.current.clear();
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearCaches,
    touchState
  };
};
