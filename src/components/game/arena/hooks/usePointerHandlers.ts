
import { useCallback } from 'react';
import { Concept, RotationRef, MouseRef, DragState, InteractionMode } from '../types';
import { rotatePoint, project3DTo2D, screenToSphere } from '../utils';

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
      const size = 8 + concept.energy * 4 * projected.scale;
      
      if (distance < size + 10) {
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
    mouseRef.current = { x, y, isDown: true, touchId };
    
    const conceptHit = findConceptAtPosition(x, y, canvas, rotationRef);
    
    if (conceptHit) {
      setInteractionMode('selecting');
      
      // Start drag timeout for concepts
      dragTimeoutRef.current = window.setTimeout(() => {
        if (mouseRef.current.isDown) {
          setInteractionMode('dragging');
          setDragState({
            isDragging: true,
            conceptId: conceptHit.concept.id,
            startX: x,
            startY: y,
            offsetX: 0,
            offsetY: 0
          });
        }
      }, 200); // Reduced timeout for more responsive dragging
    } else {
      setInteractionMode('rotating');
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
    if (!mouseRef.current.isDown) return;

    const deltaX = x - mouseRef.current.x;
    const deltaY = y - mouseRef.current.y;

    if (interactionMode === 'rotating') {
      // Rotate sphere
      rotationRef.current.x += deltaY * 0.01;
      rotationRef.current.y += deltaX * 0.01;
      
      mouseRef.current.x = x;
      mouseRef.current.y = y;
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      // Update drag position with real-time sphere projection
      const spherePos = screenToSphere(x, y, canvas, rotationRef);
      setDragState(prev => ({
        ...prev,
        offsetX: x - prev.startX,
        offsetY: y - prev.startY,
        sphereX: spherePos.x,
        sphereY: spherePos.y,
        sphereZ: spherePos.z
      }));
    } else if (interactionMode === 'selecting') {
      // Check if we've moved enough to start sphere rotation
      const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (moveDistance > 8) {
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
        setInteractionMode('rotating');
        rotationRef.current.x += deltaY * 0.01;
        rotationRef.current.y += deltaX * 0.01;
        mouseRef.current.x = x;
        mouseRef.current.y = y;
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
      // Finish dragging - use the calculated sphere coordinates
      if (dragState.sphereX !== undefined && dragState.sphereY !== undefined && dragState.sphereZ !== undefined) {
        onConceptMove(dragState.conceptId, dragState.sphereX, dragState.sphereY, dragState.sphereZ);
      }
    }

    // Reset state
    mouseRef.current.isDown = false;
    setInteractionMode('idle');
    setDragState({
      isDragging: false,
      conceptId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0
    });
  }, [concepts, findConceptAtPosition, onConceptClick, onConceptMove]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
};
