
import { useRef } from 'react';
import { RotationRef, Concept } from './types';
import { usePointerState } from './hooks/usePointerState';
import { useInteractionMode } from './hooks/useInteractionMode';
import { useSimplifiedPointerHandlers } from './hooks/useSimplifiedPointerHandlers';
import { useEventHandlers } from './hooks/useEventHandlers';

export const useInteractions = (
  concepts: Concept[],
  onConceptClick: (conceptId: string) => void,
  onConceptMove: (conceptId: string, newX: number, newY: number, newZ: number) => void
) => {
  const rotationRef = useRef<RotationRef>({ x: 0, y: 0 });
  
  const { mouseRef } = usePointerState();
  const { 
    dragState, 
    setDragState, 
    interactionMode, 
    setInteractionMode, 
    dragTimeoutRef, 
    getCursor 
  } = useInteractionMode();

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  } = useSimplifiedPointerHandlers(concepts, onConceptClick, onConceptMove);

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useEventHandlers(
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    rotationRef,
    mouseRef,
    interactionMode,
    dragState,
    setInteractionMode,
    setDragState,
    dragTimeoutRef
  );

  return {
    mouseRef,
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
  };
};
