
import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TouchFeedbackProps {
  children: React.ReactNode;
  className?: string;
  feedbackType?: 'ripple' | 'scale' | 'highlight';
  duration?: number;
  disabled?: boolean;
}

export const TouchFeedback: React.FC<TouchFeedbackProps> = ({
  children,
  className,
  feedbackType = 'ripple',
  duration = 300,
  disabled = false
}) => {
  const [isActive, setIsActive] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const rippleIdRef = useRef(0);

  const createRipple = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    if (disabled || feedbackType !== 'ripple') return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ('touches' in event ? event.touches[0].clientX : event.clientX) - rect.left;
    const y = ('touches' in event ? event.touches[0].clientY : event.clientY) - rect.top;
    
    const newRipple = {
      id: rippleIdRef.current++,
      x,
      y
    };
    
    setRipples(prev => [...prev, newRipple]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, duration);
  }, [disabled, feedbackType, duration]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return;
    
    setIsActive(true);
    createRipple(event);
  }, [disabled, createRipple]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    
    setTimeout(() => setIsActive(false), 100);
  }, [disabled]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled) return;
    
    setIsActive(true);
    createRipple(event);
  }, [disabled, createRipple]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    
    setTimeout(() => setIsActive(false), 100);
  }, [disabled]);

  const getFeedbackClasses = () => {
    if (disabled || !isActive) return '';
    
    switch (feedbackType) {
      case 'scale':
        return 'scale-95';
      case 'highlight':
        return 'bg-white/10';
      default:
        return '';
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden transition-transform duration-150",
        getFeedbackClasses(),
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {children}
      
      {/* Ripple effects */}
      {feedbackType === 'ripple' && ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute pointer-events-none rounded-full bg-white/30 animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
            animationDuration: `${duration}ms`
          }}
        />
      ))}
    </div>
  );
};
