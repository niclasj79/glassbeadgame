import React, { useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, BookOpen, Brain } from 'lucide-react';

interface HeroSectionProps {
  onStartGame: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onStartGame }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated mini sphere preview
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const cx = w / 2;
    const cy = h / 2;
    const t = Date.now() * 0.0008;
    const radius = Math.min(w, h) * 0.3;

    ctx.clearRect(0, 0, w, h);

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.5);
    glow.addColorStop(0, 'hsla(260, 60%, 50%, 0.12)');
    glow.addColorStop(0.5, 'hsla(240, 50%, 40%, 0.05)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Wireframe circles
    const segments = 8;
    ctx.strokeStyle = 'hsla(260, 50%, 60%, 0.12)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < segments; i++) {
      const angle = (i / segments) * Math.PI;
      const r = Math.sin(angle) * radius;
      const y = Math.cos(angle) * radius;
      ctx.beginPath();
      for (let j = 0; j <= 48; j++) {
        const a = (j / 48) * Math.PI * 2;
        const px = cx + Math.cos(a + t) * r;
        const py = cy + y * 0.6 + Math.sin(a + t) * r * 0.4;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Floating beads
    const beadColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t;
      const r2 = radius * (0.5 + Math.sin(t * 1.5 + i) * 0.3);
      const bx = cx + Math.cos(a) * r2;
      const by = cy + Math.sin(a * 0.7) * r2 * 0.5;
      const color = beadColors[i % beadColors.length];
      const size = 4 + Math.sin(t + i) * 2;

      // Bead glow
      const beadGlow = ctx.createRadialGradient(bx, by, 0, bx, by, size * 3);
      beadGlow.addColorStop(0, color + '40');
      beadGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = beadGlow;
      ctx.beginPath();
      ctx.arc(bx, by, size * 3, 0, Math.PI * 2);
      ctx.fill();

      // Bead
      const beadGrad = ctx.createRadialGradient(bx - size * 0.3, by - size * 0.3, 0, bx, by, size);
      beadGrad.addColorStop(0, '#ffffff');
      beadGrad.addColorStop(0.3, color);
      beadGrad.addColorStop(1, color + '80');
      ctx.fillStyle = beadGrad;
      ctx.beginPath();
      ctx.arc(bx, by, size, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(renderPreview);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(raf);
  }, [renderPreview]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'hsl(240, 60%, 3%)' }}>
      {/* Animated canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.7 }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-5xl md:text-7xl font-extralight tracking-wider mb-2">
            <span className="bg-gradient-to-r from-blue-200 via-purple-200 to-indigo-200 bg-clip-text text-transparent">
              The Glass
            </span>
          </h1>
          <h1 className="text-5xl md:text-7xl font-extralight tracking-wider mb-6">
            <span className="bg-gradient-to-r from-purple-200 via-indigo-200 to-blue-200 bg-clip-text text-transparent">
              Bead Game
            </span>
          </h1>
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-game-glow/50 to-transparent mx-auto mb-6" />
        </div>

        <p className="text-lg md:text-xl game-text-dim mb-2 font-light italic">
          Das Glasperlenspiel
        </p>
        <p className="text-base md:text-lg game-text-dim mb-8 max-w-xl mx-auto leading-relaxed">
          Drag concepts together to discover hidden connections across disciplines.
          Build resonance. Uncover the unity of knowledge.
        </p>

        <Button
          onClick={onStartGame}
          size="lg"
          className="bg-game-glow/20 hover:bg-game-glow/30 text-game-glow border border-game-glow/30 px-8 py-3 text-lg font-light tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-game-glow/20"
        >
          <Sparkles className="w-5 h-5 mr-3" />
          Begin
        </Button>

        <blockquote className="mt-10 text-sm md:text-base game-text-dim italic max-w-2xl mx-auto leading-relaxed">
          "The Game was thus a mode of playing with the total contents and values of our culture"
          <footer className="text-xs game-text-dim mt-2 not-italic opacity-60">— Hermann Hesse</footer>
        </blockquote>

        <div className="flex gap-6 justify-center items-center mt-8">
          <div className="flex items-center gap-2 text-xs game-text-dim">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Explore Knowledge</span>
          </div>
          <div className="flex items-center gap-2 text-xs game-text-dim">
            <Brain className="w-3.5 h-3.5" />
            <span>Discover Connections</span>
          </div>
        </div>
      </div>
    </div>
  );
};
