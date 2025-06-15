
import { useRef, useState, useCallback } from 'react';
import { MouseRef, RotationRef, DragState, InteractionMode, Concept } from './types';
import { rotatePoint, project3DTo2D } from './utils';

export const useInteractions = (
  concepts: Concept[],
  onConceptClick: (conceptId: string) => void,
  onConceptMove: (conceptId: string, newX: number, newY: number) => void
) => {
  const mouseRef = useRef<MouseRef>({ x: 0, y: 0, isDown: false });
  const rotationRef = useRef<RotationRef>({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    conceptId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  });
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const dragTimeoutRef = useRef<number>();

  const findConceptAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement) => {
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

  const handlePointerDown = useCallback((x: number, y: number, canvas: HTMLCanvasElement, touchId?: number) => {
    mouseRef.current = { x, y, isDown: true, touchId };
    
    const conceptHit = findConceptAtPosition(x, y, canvas);
    
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
            offsetX: x - conceptHit.projected.x,
            offsetY: y - conceptHit.projected.y
          });
        }
      }, 300); // 300ms hold to start dragging
    } else {
      setInteractionMode('rotating');
    }
  }, [findConceptAtPosition]);

  const handlePointerMove = useCallback((x: number, y: number, canvas: HTMLCanvasElement) => {
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
      // Update drag position
      setDragState(prev => ({
        ...prev,
        offsetX: x - prev.startX,
        offsetY: y - prev.startY
      }));
    } else if (interactionMode === 'selecting') {
      // Check if we've moved enough to start sphere rotation
      const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (moveDistance > 10) {
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
  }, [interactionMode, dragState]);

  const handlePointerUp = useCallback((x: number, y: number, canvas: HTMLCanvasElement) => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    if (interactionMode === 'selecting') {
      // This was a tap/click
      const conceptHit = findConceptAtPosition(x, y, canvas);
      if (conceptHit) {
        onConceptClick(conceptHit.concept.id);
      }
    } else if (interactionMode === 'dragging' && dragState.isDragging && dragState.conceptId) {
      // Finish dragging - convert screen coordinates to 3D position
      const concept = concepts.find(c => c.id === dragState.conceptId);
      if (concept) {
        // Calculate new 3D position based on current sphere rotation and screen offset
        const sphereRadius = 200;
        const newScreenX = dragState.startX + dragState.offsetX;
        const newScreenY = dragState.startY + dragState.offsetY;
        
        // Convert screen coordinates back to 3D sphere coordinates
        // This is a simplified approach - we'll maintain the Z distance but update X,Y
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Calculate relative position on sphere surface
        const relativeX = (newScreenX - centerX) / sphereRadius;
        const relativeY = (newScreenY - centerY) / sphereRadius;
        
        // Constrain to sphere surface
        const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
        if (distance <= 1) {
          const newX = relativeX * sphereRadius;
          const newY = relativeY * sphereRadius;
          const newZ = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - newX * newX - newY * newY));
          
          // Apply inverse rotation to get world coordinates
          const inverseRotated = rotatePoint(newX, newY, newZ, -rotationRef.current.x, -rotationRef.current.y);
          onConceptMove(dragState.conceptId, inverseRotated.x, inverseRotated.y);
        }
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
  }, [interactionMode, dragState, concepts, findConceptAtPosition, onConceptClick, onConceptMove]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointerDown(x, y, canvas);
  }, [handlePointerDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointerMove(x, y, canvas);
  }, [handlePointerMove]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointerUp(x, y, canvas);
  }, [handlePointerUp]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      handlePointerDown(x, y, canvas, touch.identifier);
    }
  }, [handlePointerDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (mouseRef.current.touchId === undefined || mouseRef.current.touchId === touch.identifier) {
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handlePointerMove(x, y, canvas);
      }
    }
  }, [handlePointerMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      if (mouseRef.current.touchId === undefined || mouseRef.current.touchId === touch.identifier) {
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handlePointerUp(x, y, canvas);
      }
    }
  }, [handlePointerUp]);

  const getCursor = useCallback(() => {
    switch (interactionMode) {
      case 'rotating':
        return 'grabbing';
      case 'dragging':
        return 'move';
      case 'selecting':
        return 'pointer';
      default:
        return 'grab';
    }
  }, [interactionMode]);

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
