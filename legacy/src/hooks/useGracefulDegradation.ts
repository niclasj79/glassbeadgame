
import { useState, useEffect, useCallback } from 'react';

interface FeatureSupport {
  webGL: boolean;
  webAudio: boolean;
  canvas: boolean;
  localStorage: boolean;
  requestAnimationFrame: boolean;
}

interface DegradationSettings {
  enabledFeatures: Partial<FeatureSupport>;
  performanceMode: boolean;
  fallbackMode: boolean;
}

const checkFeatureSupport = (): FeatureSupport => {
  const support: FeatureSupport = {
    webGL: false,
    webAudio: false,
    canvas: false,
    localStorage: false,
    requestAnimationFrame: false
  };

  try {
    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    support.webGL = !!gl;
    
    // Check Canvas support
    support.canvas = !!canvas.getContext('2d');
    
    // Check Web Audio API support
    support.webAudio = !!(window.AudioContext || (window as any).webkitAudioContext);
    
    // Check localStorage support
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      support.localStorage = true;
    } catch {
      support.localStorage = false;
    }
    
    // Check requestAnimationFrame support
    support.requestAnimationFrame = !!window.requestAnimationFrame;
  } catch (error) {
    console.warn('Error checking feature support:', error);
  }

  return support;
};

export const useGracefulDegradation = () => {
  const [featureSupport, setFeatureSupport] = useState<FeatureSupport>(() => checkFeatureSupport());
  const [settings, setSettings] = useState<DegradationSettings>({
    enabledFeatures: {},
    performanceMode: false,
    fallbackMode: false
  });

  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 60,
    memoryUsage: 0,
    lastCheck: Date.now()
  });

  // Check performance and adjust settings
  const checkPerformance = useCallback(() => {
    const now = Date.now();
    const timeDelta = now - performanceMetrics.lastCheck;
    
    if (timeDelta > 1000) { // Check every second
      // Estimate FPS based on frame timing (simplified)
      const estimatedFPS = 1000 / (timeDelta / 60);
      
      // Check memory usage if available
      let memoryUsage = 0;
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;
      }

      setPerformanceMetrics({
        fps: estimatedFPS,
        memoryUsage,
        lastCheck: now
      });

      // Auto-degrade if performance is poor
      const shouldDegrade = estimatedFPS < 30 || memoryUsage > 0.8;
      
      setSettings(prev => ({
        ...prev,
        performanceMode: shouldDegrade,
        fallbackMode: estimatedFPS < 15 || memoryUsage > 0.9
      }));
    }
  }, [performanceMetrics.lastCheck]);

  // Run performance check periodically
  useEffect(() => {
    const interval = setInterval(checkPerformance, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [checkPerformance]);

  // Get optimized settings based on support and performance
  const getOptimizedSettings = useCallback(() => {
    const { performanceMode, fallbackMode } = settings;
    
    return {
      // Visualizer settings
      enableParticles: featureSupport.canvas && !fallbackMode,
      enableTrails: featureSupport.canvas && !performanceMode,
      enableGlow: featureSupport.webGL && !performanceMode,
      particleDensity: fallbackMode ? 0.3 : performanceMode ? 0.6 : 1.0,
      
      // Audio settings
      enable3DAudio: featureSupport.webAudio && !performanceMode,
      enableReverb: featureSupport.webAudio && !performanceMode,
      audioQuality: fallbackMode ? 'low' : performanceMode ? 'medium' : 'high',
      
      // Animation settings
      enableAnimations: featureSupport.requestAnimationFrame && !fallbackMode,
      animationQuality: fallbackMode ? 'low' : performanceMode ? 'medium' : 'high',
      maxFPS: fallbackMode ? 30 : performanceMode ? 45 : 60,
      
      // Storage settings
      enablePersistence: featureSupport.localStorage,
      enableCaching: featureSupport.localStorage && !fallbackMode
    };
  }, [featureSupport, settings]);

  // Force fallback mode
  const enableFallbackMode = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      fallbackMode: true,
      performanceMode: true
    }));
  }, []);

  // Reset to optimal settings
  const resetToOptimal = useCallback(() => {
    setSettings({
      enabledFeatures: featureSupport,
      performanceMode: false,
      fallbackMode: false
    });
  }, [featureSupport]);

  return {
    featureSupport,
    settings,
    performanceMetrics,
    getOptimizedSettings,
    enableFallbackMode,
    resetToOptimal,
    isSupported: (feature: keyof FeatureSupport) => featureSupport[feature]
  };
};
