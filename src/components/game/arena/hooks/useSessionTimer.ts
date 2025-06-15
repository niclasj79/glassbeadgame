
import { useState, useEffect, useRef } from 'react';

export const useSessionTimer = (startTime: number, isAuthenticated: boolean = false) => {
  const [sessionTime, setSessionTime] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const timerRef = useRef<number>();

  const maxDuration = isAuthenticated ? 120 : 60; // 2 minutes for auth, 1 minute for anonymous

  useEffect(() => {
    if (startTime === 0) return;

    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSessionTime(elapsed);
      
      if (elapsed >= maxDuration) {
        setIsExpired(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTime, maxDuration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingTime = Math.max(0, maxDuration - sessionTime);

  return {
    sessionTime,
    remainingTime,
    isExpired,
    maxDuration,
    formatTime: () => formatTime(remainingTime)
  };
};
