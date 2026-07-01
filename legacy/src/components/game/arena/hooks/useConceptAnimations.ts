
import { useRef, useCallback, useEffect } from 'react';
import { Concept } from '../types';

interface AnimationState {
  [conceptId: string]: {
    startX: number;
    startY: number;
    startZ: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    startTime: number;
    duration: number;
    isAnimating: boolean;
  };
}

export const useConceptAnimations = () => {
  const animationStateRef = useRef<AnimationState>({});
  const animationFrameRef = useRef<number>();

  // Start animation for a concept
  const startAnimation = useCallback((
    conceptId: string,
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
    duration: number = 800
  ) => {
    animationStateRef.current[conceptId] = {
      startX: fromX,
      startY: fromY,
      startZ: fromZ,
      targetX: toX,
      targetY: toY,
      targetZ: toZ,
      startTime: Date.now(),
      duration,
      isAnimating: true
    };
  }, []);

  // Get interpolated position for a concept
  const getAnimatedPosition = useCallback((conceptId: string, originalX: number, originalY: number, originalZ: number) => {
    const animation = animationStateRef.current[conceptId];
    if (!animation || !animation.isAnimating) {
      return { x: originalX, y: originalY, z: originalZ, isAnimating: false };
    }

    const now = Date.now();
    const elapsed = now - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);

    // Easing function for smooth animation (ease-out)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Interpolate position
    const x = animation.startX + (animation.targetX - animation.startX) * easedProgress;
    const y = animation.startY + (animation.targetY - animation.startY) * easedProgress;
    const z = animation.startZ + (animation.targetZ - animation.startZ) * easedProgress;

    // Check if animation is complete
    if (progress >= 1) {
      animation.isAnimating = false;
      return { x: animation.targetX, y: animation.targetY, z: animation.targetZ, isAnimating: false };
    }

    return { x, y, z, isAnimating: true };
  }, []);

  // Check if any concept is currently animating
  const hasActiveAnimations = useCallback(() => {
    return Object.values(animationStateRef.current).some(anim => anim.isAnimating);
  }, []);

  // Clear animation for a concept
  const clearAnimation = useCallback((conceptId: string) => {
    if (animationStateRef.current[conceptId]) {
      animationStateRef.current[conceptId].isAnimating = false;
    }
  }, []);

  // Clear all animations
  const clearAllAnimations = useCallback(() => {
    Object.keys(animationStateRef.current).forEach(conceptId => {
      animationStateRef.current[conceptId].isAnimating = false;
    });
  }, []);

  return {
    startAnimation,
    getAnimatedPosition,
    hasActiveAnimations,
    clearAnimation,
    clearAllAnimations
  };
};
