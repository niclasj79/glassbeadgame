import { useCallback } from 'react';
import { MouseRef, RotationRef, DragState, InteractionMode, TouchInfo } from '../types';
import { getTouchDistance, getTouchCenter } from '../utils';

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
  // Mouse event handlers - unchanged behavior
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

  // Enhanced touch event handlers with multi-touch support
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    // Update active touches
    const newTouches: TouchInfo[] = Array.from(e.touches).map(touch => ({
      id: touch.identifier,
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    }));
    
    mouseRef.current.activeTouches = newTouches;

    if (newTouches.length === 1) {
      // Single touch - potential concept drag or rotation
      const touch = newTouches[0];
      handlePointerDown(touch.x, touch.y, canvas, rotationRef, mouseRef, setInteractionMode, setDragState, dragTimeoutRef, touch.id);
    } else if (newTouches.length === 2) {
      // Two finger touch - sphere rotation
      const center = getTouchCenter(newTouches[0], newTouches[1]);
      mouseRef.current.x = center.x;
      mouseRef.current.y = center.y;
      mouseRef.current.twoFingerRotation = true;
      setInteractionMode('two-finger-rotating');
    }
  }, [handlePointerDown, rotationRef, mouseRef, setInteractionMode, setDragState, dragTimeoutRef]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    // Update active touches
    const newTouches: TouchInfo[] = Array.from(e.touches).map(touch => ({
      id: touch.identifier,
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    }));
    
    mouseRef.current.activeTouches = newTouches;

    if (newTouches.length === 1 && !mouseRef.current.twoFingerRotation) {
      // Single touch move
      const touch = newTouches[0];
      if (mouseRef.current.touchId === undefined || mouseRef.current.touchId === touch.id) {
        handlePointerMove(touch.x, touch.y, canvas, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef);
      }
    } else if (newTouches.length === 2 && mouseRef.current.twoFingerRotation) {
      // Two finger rotation
      const center = getTouchCenter(newTouches[0], newTouches[1]);
      const deltaX = center.x - mouseRef.current.x;
      const deltaY = center.y - mouseRef.current.y;
      
      rotationRef.current.x += deltaY * 0.01;
      rotationRef.current.y += deltaX * 0.01;
      
      mouseRef.current.x = center.x;
      mouseRef.current.y = center.y;
    }
  }, [handlePointerMove, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    // Update active touches
    const remainingTouches: TouchInfo[] = Array.from(e.touches).map(touch => ({
      id: touch.identifier,
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    }));
    
    mouseRef.current.activeTouches = remainingTouches;

    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      
      if (remainingTouches.length === 0) {
        // Last touch ended
        if (mouseRef.current.touchId === undefined || mouseRef.current.touchId === touch.identifier) {
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          handlePointerUp(x, y, canvas, rotationRef, mouseRef, interactionMode, dragState, setInteractionMode, setDragState, dragTimeoutRef);
        }
        mouseRef.current.twoFingerRotation = false;
      } else if (remainingTouches.length === 1 && mouseRef.current.twoFingerRotation) {
        // Went from two fingers to one - end rotation mode
        mouseRef.current.twoFingerRotation = false;
        setInteractionMode('idle');
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
