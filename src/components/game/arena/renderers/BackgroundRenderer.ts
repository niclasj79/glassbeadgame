export class BackgroundRenderer {
  private static starCache: { x: number; y: number; size: number; brightness: number }[] = [];
  private static lastCanvasSize = { w: 0, h: 0 };

  static render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const w = canvas.width;
    const h = canvas.height;

    // Deep space gradient
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
    gradient.addColorStop(0, 'hsl(260, 40%, 8%)');
    gradient.addColorStop(0.4, 'hsl(250, 50%, 5%)');
    gradient.addColorStop(0.7, 'hsl(240, 60%, 3%)');
    gradient.addColorStop(1, 'hsl(240, 60%, 2%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Nebula clouds
    const t = Date.now() * 0.0001;
    const nebula1 = ctx.createRadialGradient(
      w * 0.3 + Math.sin(t) * 40, h * 0.4 + Math.cos(t * 0.7) * 30, 0,
      w * 0.3 + Math.sin(t) * 40, h * 0.4 + Math.cos(t * 0.7) * 30, w * 0.35
    );
    nebula1.addColorStop(0, 'hsla(280, 60%, 30%, 0.06)');
    nebula1.addColorStop(0.5, 'hsla(260, 50%, 20%, 0.03)');
    nebula1.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula1;
    ctx.fillRect(0, 0, w, h);

    const nebula2 = ctx.createRadialGradient(
      w * 0.7 + Math.cos(t * 0.8) * 50, h * 0.6 + Math.sin(t * 0.6) * 40, 0,
      w * 0.7 + Math.cos(t * 0.8) * 50, h * 0.6 + Math.sin(t * 0.6) * 40, w * 0.3
    );
    nebula2.addColorStop(0, 'hsla(220, 60%, 35%, 0.05)');
    nebula2.addColorStop(0.5, 'hsla(200, 40%, 25%, 0.02)');
    nebula2.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, w, h);

    // Star field (cached)
    if (this.lastCanvasSize.w !== w || this.lastCanvasSize.h !== h) {
      this.starCache = Array.from({ length: 80 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.5 + 0.3,
        brightness: Math.random() * 0.5 + 0.2
      }));
      this.lastCanvasSize = { w, h };
    }

    const twinkle = Date.now() * 0.002;
    for (const star of this.starCache) {
      const alpha = star.brightness + Math.sin(twinkle + star.x * 0.01) * 0.15;
      ctx.fillStyle = `rgba(200, 210, 255, ${Math.max(0, alpha)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
