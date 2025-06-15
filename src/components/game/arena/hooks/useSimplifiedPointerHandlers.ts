
import { useCallback, useRef } from 'react';
import { Concept, RotationRef, MouseRef, DragState, InteractionMode } from '../types';
import { rotatePoint, project3DTo2D, screenToSphere } from '../utils';

export const useSimplifiedPointerHandlers = (
  concepts: Concept[],
  onConceptClick: (conceptId: string) => void,
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void
) => {
  const findConceptAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<RotationRef>) => {
    for (const concept of concepts) {
      const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
      const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
      
      const distance = Math.sqrt((x - projected.x) ** 2 + (y - projected.y) ** 2);
      const baseSize = 8 + concept.energy * 4 * projected.scale;
      const touchSize = Math.max(baseSize + 20, 40); // Larger touch target
      
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
    mouseRef.current = { 
      ...mouseRef.current,
      x, 
      y, 
      isDown: true, 
      touchId
    };
    
    const conceptHit = findConceptAtPosition(x, y, canvas, rotationRef);
    
    if (conceptHit) {
      console.log('Concept clicked:', conceptHit.concept.text);
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
      
      // Dispatch drag start event
      window.dispatchEvent(new CustomEvent('conceptdragstart'));
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
      rotationRef.current.x += deltaY * 0.01;
      rotationRef.current.y += deltaX * 0.01;
      mouseRef.current.x = x;
      mouseRef.current.y = y;
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
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
    if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      if (dragState.sphereX !== undefined && dragState.sphereY !== undefined && dragState.sphereZ !== undefined) {
        console.log('Completing concept move:', dragState.conceptId, 'to:', dragState.sphereX, dragState.sphereY, dragState.sphereZ);
        onConceptMove(dragState.conceptId, dragState.sphereX, dragState.sphereY, dragState.sphereZ);
      }
    } else if (Math.abs(x - mouseRef.current.x) < 5 && Math.abs(y - mouseRef.current.y) < 5) {
      const conceptHit = findConceptAtPosition(x, y, canvas, rotationRef);
      if (conceptHit) {
        onConceptClick(conceptHit.concept.id);
      }
    }

    mouseRef.current.isDown = false;
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
  }, [findConceptAtPosition, onConceptClick, onConceptMove]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
};
