import { useEffect, useRef, useCallback } from 'react';
import { memoryManager } from '../utils/memoryManager';

interface PerformanceConfig {
  enableMemoryMonitoring: boolean;
  enableFrameRateMonitoring: boolean;
  targetFPS: number;
  memoryThreshold: number; // MB
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enableMemoryMonitoring: true,
  enableFrameRateMonitoring: true,
  targetFPS: 60,
  memoryThreshold: 100
};

export const usePerformanceOptimization = (config: Partial<PerformanceConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const frameTimeRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const performanceMetrics = useRef({
    averageFPS: 60,
    frameTime: 16.67,
    memoryUsage: '0MB',
    isOptimal: true
  });

  // Frame rate monitoring
  const measureFrameRate = useCallback(() => {
    const now = performance.now();
    
    if (lastFrameTimeRef.current > 0) {
      const frameTime = now - lastFrameTimeRef.current;
      frameTimeRef.current.push(frameTime);
      
      // Keep only last 60 measurements
      if (frameTimeRef.current.length > 60) {
        frameTimeRef.current.shift();
      }
      
      // Calculate average FPS
      if (frameTimeRef.current.length >= 10) {
        const avgFrameTime = frameTimeRef.current.reduce((a, b) => a + b) / frameTimeRef.current.length;
        const fps = 1000 / avgFrameTime;
        
        performanceMetrics.current.averageFPS = fps;
        performanceMetrics.current.frameTime = avgFrameTime;
        performanceMetrics.current.isOptimal = fps >= finalConfig.targetFPS * 0.9; // 90% of target
      }
    }
    
    lastFrameTimeRef.current = now;
  }, [finalConfig.targetFPS]);

  // Throttled performance check
  const throttledPerformanceCheck = useCallback(() => {
    const memory = memoryManager.getCurrentMemoryUsage();
    performanceMetrics.current.memoryUsage = memory.used;
    
    // Check if performance is degrading
    if (memory.percentage > 90 || performanceMetrics.current.averageFPS < finalConfig.targetFPS * 0.7) {
      console.warn('Performance degradation detected:', {
        fps: performanceMetrics.current.averageFPS.toFixed(1),
        memory: memory.used,
        memoryPercentage: memory.percentage
      });
      
      // Trigger garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }
    }
  }, [finalConfig.targetFPS]);

  // Performance optimization effect
  useEffect(() => {
    if (!finalConfig.enableFrameRateMonitoring && !finalConfig.enableMemoryMonitoring) {
      return;
    }

    let animationId: number;
    let performanceCheckInterval: number;

    const animate = () => {
      if (finalConfig.enableFrameRateMonitoring) {
        measureFrameRate();
      }
      animationId = requestAnimationFrame(animate);
    };

    // Start frame rate monitoring
    if (finalConfig.enableFrameRateMonitoring) {
      animate();
    }

    // Start memory monitoring
    if (finalConfig.enableMemoryMonitoring) {
      memoryManager.startMonitoring();
      performanceCheckInterval = window.setInterval(throttledPerformanceCheck, 10000); // Every 10 seconds
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (performanceCheckInterval) {
        clearInterval(performanceCheckInterval);
      }
    };
  }, [finalConfig, measureFrameRate, throttledPerformanceCheck]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      memoryManager.cleanup();
    };
  }, []);

  const getPerformanceMetrics = useCallback(() => {
    return { ...performanceMetrics.current };
  }, []);

  const optimizeForLowPerformance = useCallback(() => {
    // Reduce quality settings for better performance
    console.log('Optimizing for low performance...');
    
    // Could implement:
    // - Reduce animation quality
    // - Lower render resolution
    // - Disable non-essential features
    // - Increase throttling
    
    return {
      reducedAnimations: true,
      lowerQuality: true,
      increasedThrottling: true
    };
  }, []);

  return {
    getPerformanceMetrics,
    optimizeForLowPerformance,
    isOptimal: performanceMetrics.current.isOptimal
  };
};
