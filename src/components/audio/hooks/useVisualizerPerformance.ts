
import { useRef, useCallback, useState } from 'react';

export const useVisualizerPerformance = () => {
  const lastFrameTime = useRef(Date.now());
  const frameCount = useRef(0);
  const fpsRef = useRef(60);
  const [performanceMode, setPerformanceMode] = useState(false);

  const updatePerformanceMode = useCallback(() => {
    frameCount.current++;
    if (frameCount.current % 60 === 0) {
      const now = Date.now();
      const delta = now - lastFrameTime.current;
      fpsRef.current = 1000 / (delta / 60);
      lastFrameTime.current = now;

      // Auto-adjust performance mode
      if (fpsRef.current < 30 && !performanceMode) {
        setPerformanceMode(true);
        console.log('Enhanced Synesthesia: Switching to performance mode');
      } else if (fpsRef.current > 50 && performanceMode) {
        setPerformanceMode(false);
        console.log('Enhanced Synesthesia: Switching to quality mode');
      }
    }
  }, [performanceMode]);

  return {
    performanceMode,
    fps: fpsRef.current,
    updatePerformanceMode
  };
};
