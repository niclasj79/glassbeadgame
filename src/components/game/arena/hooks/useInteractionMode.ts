
import { useState, useRef } from 'react';
import { DragState, InteractionMode } from '../types';

export const useInteractionMode = () => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    conceptId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    touchDragMode: false
  });
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const dragTimeoutRef = useRef<number>();

  const getCursor = () => {
    switch (interactionMode) {
      case 'rotating':
      case 'two-finger-rotating':
        return 'grabbing';
      case 'dragging':
        return 'move';
      case 'selecting':
        return 'pointer';
      default:
        return 'grab';
    }
  };

  return {
    dragState,
    setDragState,
    interactionMode,
    setInteractionMode,
    dragTimeoutRef,
    getCursor
  };
};
