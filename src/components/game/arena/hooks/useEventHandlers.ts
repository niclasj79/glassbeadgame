
import { useCallback } from 'react';
import { MouseRef, RotationRef, DragState, InteractionMode } from '../types';

export const useEventHandlers = (
  handlePointerDown: (
    x: number, 
    y: number, 
    canvas: HTMLCanvasElement, 
    rotationRef: React.MutableRefObject<RotationRef>,
    mouseRef: React.MutableRefObject<MouseRef>,
    setInteractionMode: (mode: InteractionMode) => void,
    setDragState: (state: DragState | ((prev: DragState) => DragState)) => void,
    dragTimeoutRef: React.MutableRefObject<number | undefined>,
    touchId?: number
  ) => void,
  handlePointerMove: (
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
  ) => void,
  handlePointerUp: (
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
  ) => void,
  rotationRef: React.MutableRefObject<RotationRef>,
  mouseRef: React.MutableRefObject<MouseRef>,
  interactionMode: InteractionMode,
  dragState: DragState,
  setInteractionMode: (mode: InteractionMode) => void,
  setDragState: (state: DragState | ((prev: DragState) => DragState)) => void,
  dragTimeoutRef: React.MutableRefObject<number | undefined>
) => {
  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointerDown(x, y, canvas, rotationRef, mouseRef, setInteractionMode, setDragState, dragTimeoutRef);
  }, [handlePointerDown, rotationRef, mouseRef, setInteractionMode, setDragState, dragTimeoutRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointerMove(x, y, canvas, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef);
  }, [handlePointerMove, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointerUp(x, y, canvas, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef);
  }, [handlePointerUp, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      handlePointerDown(x, y, canvas, rotationRef, mouseRef, setInteractionMode, setDragState, dragTimeoutRef, touch.identifier);
    }
  }, [handlePointerDown, rotationRef, mouseRef, setInteractionMode, setDragState, dragTimeoutRef]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (mouseRef.current.touchId === undefined || mouseRef.current.touchId === touch.identifier) {
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handlePointerMove(x, y, canvas, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef);
      }
    }
  }, [handlePointerMove, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      if (mouseRef.current.touchId === undefined || mouseRef.current.touchId === touch.identifier) {
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handlePointerUp(x, y, canvas, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef);
      }
    }
  }, [handlePointerUp, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
};
