import React, { useState, useEffect, useRef } from 'react';
import { Concept } from './types';
import { conceptDescriptions } from '../concept/conceptDescriptions';
import { hexToRgb } from './utils';

interface ConceptInfoOverlayProps {
  concept: Concept | null;
  discipline: any | null;
  onDismiss: () => void;
}

interface StarChar {
  char: string;
  x: number;
  y: number;
  opacity: number;
  delay: number;
  arrived: boolean;
}

export const ConceptInfoOverlay: React.FC<ConceptInfoOverlayProps> = ({ concept, discipline, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [starChars, setStarChars] = useState<StarChar[]>([]);
  const [revealProgress, setRevealProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>();
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!concept) {
      setVisible(false);
      setStarChars([]);
      setRevealProgress(0);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const description = conceptDescriptions[concept.text] || `A concept from the domain of ${concept.discipline}, inviting exploration and cross-disciplinary connection.`;
    const fullText = description;

    // Build star chars with staggered delays
    const chars: StarChar[] = [];
    let charIndex = 0;
    const charsPerLine = 50;
    const lineHeight = 22;
    const startX = 20;
    let curX = startX;
    let curY = 60;

    // Word-wrap
    const words = fullText.split(' ');
    let lineChars = 0;

    for (const word of words) {
      if (lineChars + word.length > charsPerLine && lineChars > 0) {
        curX = startX;
        curY += lineHeight;
        lineChars = 0;
      }
      for (const c of word) {
        chars.push({
          char: c,
          x: curX,
          y: curY,
          opacity: 0,
          delay: charIndex * 12, // ms per char
          arrived: false,
        });
        curX += 8.5;
        charIndex++;
        lineChars++;
      }
      // Space
      chars.push({
        char: ' ',
        x: curX,
        y: curY,
        opacity: 0,
        delay: charIndex * 12,
        arrived: false,
      });
      curX += 8.5;
      charIndex++;
      lineChars++;
    }

    setStarChars(chars);
    setVisible(true);
    startTimeRef.current = performance.now();

    // Animate reveal
    const animate = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = elapsed;
      setRevealProgress(progress);
      if (progress < chars.length * 12 + 500) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [concept?.id]);

  if (!concept || !discipline || !visible) return null;

  const rgb = hexToRgb(discipline.color);
  const elapsed = revealProgress;

  return (
    <div
      className="fixed z-40 pointer-events-auto"
      style={{
        right: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '460px',
        maxWidth: 'calc(100vw - 32px)',
      }}
      onClick={onDismiss}
      ref={containerRef}
    >
      {/* Title with starry glow */}
      <div className="relative mb-3" style={{ opacity: Math.min(1, elapsed / 300) }}>
        <h3
          className="text-lg font-bold tracking-wide"
          style={{
            color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
            textShadow: `0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), 0 0 40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
          }}
        >
          {discipline.icon} {concept.text}
        </h3>
        <div
          className="text-xs mt-1 font-medium tracking-widest uppercase"
          style={{
            color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`,
          }}
        >
          {discipline.name}
        </div>
      </div>

      {/* Animated text body - starry trail reveal */}
      <div className="relative" style={{ minHeight: `${Math.ceil(starChars.length / 50) * 22 + 40}px` }}>
        {/* Trailing glow canvas behind text */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          {starChars.map((sc, i) => {
            if (sc.char === ' ') return null;
            const charElapsed = elapsed - sc.delay;
            if (charElapsed < 0) return null;

            // Trailing sparkle that fades
            const sparklePhase = Math.max(0, Math.min(1, charElapsed / 200));
            const sparkleAlpha = sparklePhase < 0.5 ? sparklePhase * 2 : Math.max(0, 1 - (sparklePhase - 0.5) * 3);

            if (sparkleAlpha < 0.01) return null;

            return (
              <circle
                key={`spark-${i}`}
                cx={sc.x + 4}
                cy={sc.y - 4}
                r={2 + sparkleAlpha * 2}
                fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${sparkleAlpha * 0.5})`}
              />
            );
          })}
        </svg>

        {/* Text characters */}
        <div className="relative" style={{ fontFamily: 'Georgia, serif', fontSize: '14px', lineHeight: '22px' }}>
          {starChars.map((sc, i) => {
            const charElapsed = elapsed - sc.delay;
            const charOpacity = Math.min(1, Math.max(0, charElapsed / 150));
            // Slight upward drift as they appear
            const yOffset = charOpacity < 1 ? (1 - charOpacity) * 8 : 0;

            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: `${sc.x}px`,
                  top: `${sc.y - yOffset}px`,
                  opacity: charOpacity,
                  color: charOpacity > 0.8
                    ? 'hsl(var(--game-text-bright))'
                    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${charOpacity})`,
                  transition: 'color 0.3s',
                  textShadow: charOpacity < 0.9
                    ? `0 0 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(1 - charOpacity) * 0.8})`
                    : 'none',
                }}
              >
                {sc.char}
              </span>
            );
          })}
        </div>
      </div>

      {/* Dismiss hint */}
      <div
        className="mt-2 text-xs tracking-wide"
        style={{
          opacity: Math.min(0.5, Math.max(0, (elapsed - 1500) / 1000)),
          color: 'hsl(var(--game-text-dim))',
        }}
      >
        tap to dismiss
      </div>
    </div>
  );
};
