export class BackgroundRenderer {
  private static starCache: { x: number; y: number; size: number; brightness: number }[] = [];
  private static lastCanvasSize = { w: 0, h: 0 };
  private static discoveryGlow = 0;

  static triggerDiscoveryGlow() {
    this.discoveryGlow = 1;
  }

  static render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scoreIntensity: number = 0) {
    const w = canvas.width;
    const h = canvas.height;
    const t = Date.now() * 0.001;

    // Decay discovery glow
    if (this.discoveryGlow > 0) this.discoveryGlow *= 0.97;

    // Deep space gradient - reactive to score
    const baseLightness = 5 + scoreIntensity * 3 + this.discoveryGlow * 8;
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
    gradient.addColorStop(0, `hsl(260, ${40 + scoreIntensity * 15}%, ${baseLightness + 3}%)`);
    gradient.addColorStop(0.4, `hsl(250, ${50 + scoreIntensity * 10}%, ${baseLightness}%)`);
    gradient.addColorStop(0.7, `hsl(240, 60%, ${baseLightness - 2}%)`);
    gradient.addColorStop(1, `hsl(240, 60%, ${Math.max(2, baseLightness - 3)}%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Nebula clouds - faster movement, beat-reactive
    const nebulaSpeed = 0.0005 + scoreIntensity * 0.0003;
    const nt = Date.now() * nebulaSpeed;
    const nebulaAlpha = 0.06 + scoreIntensity * 0.04 + this.discoveryGlow * 0.1;

    const nebula1 = ctx.createRadialGradient(
      w * 0.3 + Math.sin(nt) * 60, h * 0.4 + Math.cos(nt * 0.7) * 45, 0,
      w * 0.3 + Math.sin(nt) * 60, h * 0.4 + Math.cos(nt * 0.7) * 45, w * 0.35
    );
    nebula1.addColorStop(0, `hsla(280, 70%, 40%, ${nebulaAlpha})`);
    nebula1.addColorStop(0.5, `hsla(260, 60%, 25%, ${nebulaAlpha * 0.5})`);
    nebula1.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula1;
    ctx.fillRect(0, 0, w, h);

    const nebula2 = ctx.createRadialGradient(
      w * 0.7 + Math.cos(nt * 0.8) * 70, h * 0.6 + Math.sin(nt * 0.6) * 55, 0,
      w * 0.7 + Math.cos(nt * 0.8) * 70, h * 0.6 + Math.sin(nt * 0.6) * 55, w * 0.3
    );
    nebula2.addColorStop(0, `hsla(220, 70%, 45%, ${nebulaAlpha * 0.8})`);
    nebula2.addColorStop(0.5, `hsla(200, 50%, 30%, ${nebulaAlpha * 0.4})`);
    nebula2.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, w, h);

    // Third nebula for discovery glow
    if (this.discoveryGlow > 0.05) {
      const nebula3 = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.4);
      nebula3.addColorStop(0, `hsla(45, 80%, 60%, ${this.discoveryGlow * 0.15})`);
      nebula3.addColorStop(0.5, `hsla(30, 60%, 40%, ${this.discoveryGlow * 0.06})`);
      nebula3.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula3;
      ctx.fillRect(0, 0, w, h);
    }

    // Star field (cached)
    if (this.lastCanvasSize.w !== w || this.lastCanvasSize.h !== h) {
      this.starCache = Array.from({ length: 100 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.8 + 0.3,
        brightness: Math.random() * 0.6 + 0.2
      }));
      this.lastCanvasSize = { w, h };
    }

    const twinkle = t * 2;
    for (const star of this.starCache) {
      const alpha = star.brightness + Math.sin(twinkle + star.x * 0.01) * 0.2;
      ctx.fillStyle = `rgba(200, 210, 255, ${Math.max(0, alpha)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
