
import { useCallback } from 'react';
import { Concept, RotationRef, MouseRef, DragState, InteractionMode } from '../types';
import { rotatePoint, project3DTo2D, screenToSphere, screenToXY, isTouchNearConcept } from '../utils';

export const usePointerHandlers = (
  concepts: Concept[],
  onConceptClick: (conceptId: string) => void,
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void
) => {
  const findConceptAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<RotationRef>) => {
    for (const concept of concepts) {
      const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
      const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
      
      const distance = Math.sqrt((x - projected.x) ** 2 + (y - projected.y) ** 2);
      // Increase touch target size for mobile
      const baseSize = 8 + concept.energy * 4 * projected.scale;
      const touchSize = Math.max(baseSize + 15, 30); // Minimum 30px touch target
      
      if (distance < touchSize) {
        return { concept, projected };
      }
    }
    return null;
  }, [concepts]);

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
    // Handle two-finger touch for rotation
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
      // Always prioritize concept interaction
      setInteractionMode('selecting');
      
      if (touchId !== undefined) {
        // Touch interaction with concept - faster response
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
              touchDragMode: true
            });
          }
        }, 50); // Reduced from 150ms to 50ms
      } else {
        // Mouse interaction with concept
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
              touchDragMode: false
            });
          }
        }, 100); // Slightly reduced for mouse too
      }
    } else {
      // Empty space interaction
      if (touchId !== undefined) {
        // Touch on empty space - only allow rotation with two fingers
        // Single finger does nothing initially
        setInteractionMode('selecting');
      } else {
        // Mouse on empty space - allow rotation immediately
        setInteractionMode('rotating');
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

    const deltaX = x - mouseRef.current.x;
    const deltaY = y - mouseRef.current.y;
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (interactionMode === 'rotating' || interactionMode === 'two-finger-rotating') {
      // Rotate sphere
      rotationRef.current.x += deltaY * 0.01;
      rotationRef.current.y += deltaX * 0.01;
      
      if (interactionMode !== 'two-finger-rotating') {
        mouseRef.current.x = x;
        mouseRef.current.y = y;
      }
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      if (dragState.touchDragMode) {
        // Touch drag - XY only in current view
        const xyPos = screenToXY(x, y, canvas, rotationRef);
        setDragState(prev => ({
          ...prev,
          offsetX: x - prev.startX,
          offsetY: y - prev.startY,
          sphereX: xyPos.x,
          sphereY: xyPos.y,
          sphereZ: 0 // Keep current Z for touch
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
      // For touch, require much more movement before starting rotation
      const threshold = mouseRef.current.touchId !== undefined ? 25 : 8; // Increased threshold for touch
      
      if (moveDistance > threshold) {
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
        
        // Only allow rotation if it's not a touch interaction
        if (mouseRef.current.touchId === undefined) {
          setInteractionMode('rotating');
          rotationRef.current.x += deltaY * 0.01;
          rotationRef.current.y += deltaX * 0.01;
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
      // This was a tap/click
      const conceptHit = findConceptAtPosition(x, y, canvas, rotationRef);
      if (conceptHit) {
        onConceptClick(conceptHit.concept.id);
      }
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      // Finish dragging
      if (dragState.touchDragMode) {
        // Touch drag - update XY only, preserve current Z
        const currentConcept = concepts.find(c => c.id === dragState.conceptId);
        if (currentConcept && dragState.sphereX !== undefined && dragState.sphereY !== undefined) {
          onConceptMove(dragState.conceptId, dragState.sphereX, dragState.sphereY, currentConcept.z);
        }
      } else {
        // Mouse drag - full 3D positioning
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

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
};
