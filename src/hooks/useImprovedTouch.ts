
import { useCallback, useRef, useState, useEffect } from 'react';

interface TouchState {
  isTouch: boolean;
  touchCount: number;
  lastTouchTime: number;
  gestureType: 'none' | 'tap' | 'long-press' | 'swipe' | 'pinch' | 'rotate';
}

interface TouchGesture {
  type: string;
  touches: Touch[];
  deltaX?: number;
  deltaY?: number;
  scale?: number;
  rotation?: number;
}

interface TouchOptions {
  longPressDelay?: number;
  swipeThreshold?: number;
  doubleTapDelay?: number;
  enablePinch?: boolean;
  enableRotation?: boolean;
}

export const useImprovedTouch = (
  onGesture?: (gesture: TouchGesture) => void,
  options: TouchOptions = {}
) => {
  const {
    longPressDelay = 500,
    swipeThreshold = 50,
    doubleTapDelay = 300,
    enablePinch = true,
    enableRotation = true
  } = options;

  const [touchState, setTouchState] = useState<TouchState>({
    isTouch: false,
    touchCount: 0,
    lastTouchTime: 0,
    gestureType: 'none'
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimeoutRef = useRef<number>();
  const lastTapRef = useRef<number>(0);
  const initialDistanceRef = useRef<number>(0);
  const initialAngleRef = useRef<number>(0);

  // Detect if device supports touch
  useEffect(() => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setTouchState(prev => ({ ...prev, isTouch: hasTouch }));
  }, []);

  // Calculate distance between two touches
  const getTouchDistance = useCallback((touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate angle between two touches
  const getTouchAngle = useCallback((touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }, []);

  // Enhanced touch start handler
  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touches = Array.from(event.touches);
    const touchCount = touches.length;
    const now = Date.now();

    setTouchState(prev => ({
      ...prev,
      touchCount,
      lastTouchTime: now,
      gestureType: 'none'
    }));

    if (touchCount === 1) {
      const touch = touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now
      };

      // Start long press detection
      longPressTimeoutRef.current = window.setTimeout(() => {
        setTouchState(prev => ({ ...prev, gestureType: 'long-press' }));
        onGesture?.({
          type: 'long-press',
          touches: [touch]
        });
      }, longPressDelay);

    } else if (touchCount === 2) {
      // Initialize pinch/rotation detection
      if (enablePinch) {
        initialDistanceRef.current = getTouchDistance(touches[0], touches[1]);
      }
      if (enableRotation) {
        initialAngleRef.current = getTouchAngle(touches[0], touches[1]);
      }
    }

    // Clear any existing timeouts
    if (longPressTimeoutRef.current && touchCount > 1) {
      clearTimeout(longPressTimeoutRef.current);
    }
  }, [onGesture, longPressDelay, enablePinch, enableRotation, getTouchDistance, getTouchAngle]);

  // Enhanced touch move handler
  const handleTouchMove = useCallback((event: TouchEvent) => {
    const touches = Array.from(event.touches);
    const touchCount = touches.length;

    if (touchCount === 1 && touchStartRef.current) {
      const touch = touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Cancel long press if moved too much
      if (distance > 10 && longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }

      // Detect swipe
      if (distance > swipeThreshold) {
        setTouchState(prev => ({ ...prev, gestureType: 'swipe' }));
        onGesture?.({
          type: 'swipe',
          touches: [touch],
          deltaX,
          deltaY
        });
      }

    } else if (touchCount === 2) {
      const [touch1, touch2] = touches;
      
      // Pinch detection
      if (enablePinch) {
        const currentDistance = getTouchDistance(touch1, touch2);
        const scale = currentDistance / initialDistanceRef.current;
        
        if (Math.abs(scale - 1) > 0.1) { // Threshold to avoid noise
          setTouchState(prev => ({ ...prev, gestureType: 'pinch' }));
          onGesture?.({
            type: 'pinch',
            touches,
            scale
          });
        }
      }

      // Rotation detection
      if (enableRotation) {
        const currentAngle = getTouchAngle(touch1, touch2);
        const rotation = currentAngle - initialAngleRef.current;
        
        if (Math.abs(rotation) > 5) { // Threshold to avoid noise
          setTouchState(prev => ({ ...prev, gestureType: 'rotate' }));
          onGesture?.({
            type: 'rotate',
            touches,
            rotation
          });
        }
      }
    }
  }, [onGesture, swipeThreshold, enablePinch, enableRotation, getTouchDistance, getTouchAngle]);

  // Enhanced touch end handler
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    const now = Date.now();
    
    // Clear long press timeout
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    // Handle tap and double tap
    if (touchState.gestureType === 'none' && touchStartRef.current) {
      const timeSinceStart = now - touchStartRef.current.time;
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceStart < 200) { // Quick tap
        if (timeSinceLastTap < doubleTapDelay) {
          // Double tap
          onGesture?.({
            type: 'double-tap',
            touches: Array.from(event.changedTouches)
          });
        } else {
          // Single tap
          setTouchState(prev => ({ ...prev, gestureType: 'tap' }));
          onGesture?.({
            type: 'tap',
            touches: Array.from(event.changedTouches)
          });
        }
        lastTapRef.current = now;
      }
    }

    // Reset state when all touches are gone
    if (event.touches.length === 0) {
      setTouchState(prev => ({
        ...prev,
        touchCount: 0,
        gestureType: 'none'
      }));
      touchStartRef.current = null;
    }
  }, [touchState.gestureType, doubleTapDelay, onGesture]);

  // Prevent default behaviors that interfere with gestures
  const preventDefaults = useCallback((event: TouchEvent) => {
    if (touchState.touchCount > 1) {
      event.preventDefault(); // Prevent zoom, scroll, etc. during multi-touch
    }
  }, [touchState.touchCount]);

  return {
    touchState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    preventDefaults,
    isTouch: touchState.isTouch,
    currentGesture: touchState.gestureType
  };
};
