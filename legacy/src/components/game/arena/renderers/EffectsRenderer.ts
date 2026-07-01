import { RotationRef } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

interface DiscoveryFlash {
  x: number;
  y: number;
  startTime: number;
  duration: number;
}

// Shared state across renders
let ambientParticles: Particle[] = [];
let discoveryParticles: Particle[] = [];
let discoveryFlashes: DiscoveryFlash[] = [];
let lastAmbientSpawn = 0;
let beatPhase = 0;

export class EffectsRenderer {
  static triggerDiscoveryBurst(x: number, y: number) {
    // Add flash
    discoveryFlashes.push({ x, y, startTime: Date.now(), duration: 800 });

    // Spawn burst particles
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      discoveryParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 2 + Math.random() * 3,
        r: 255, g: 230 + Math.floor(Math.random() * 25), b: 100 + Math.floor(Math.random() * 80)
      });
    }
  }

  static setBeatIntensity(intensity: number) {
    beatPhase = intensity;
  }

  static render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    rotationRef: React.MutableRefObject<RotationRef>,
    scoreIntensity: number = 0
  ) {
    const now = Date.now();
    const w = canvas.width;
    const h = canvas.height;

    // 1. Ambient floating motes (parallax with rotation)
    if (now - lastAmbientSpawn > 200 && ambientParticles.length < 40) {
      ambientParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.3,
        life: 1,
        maxLife: 1,
        size: 0.5 + Math.random() * 1.5,
        r: 180, g: 190, b: 255
      });
      lastAmbientSpawn = now;
    }

    // Update and render ambient particles (drift with rotation)
    const rotDriftX = Math.sin(rotationRef.current.y) * 0.5;
    const rotDriftY = Math.cos(rotationRef.current.x) * 0.3;

    ambientParticles = ambientParticles.filter(p => {
      p.x += p.vx + rotDriftX;
      p.y += p.vy + rotDriftY;
      p.life -= 0.003;
      if (p.life <= 0 || p.y < -10 || p.x < -10 || p.x > w + 10) return false;

      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.life * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    // 2. Beat pulse vignette
    const beatPulse = Math.sin(now * 0.003 * (1 + scoreIntensity * 0.5)) * 0.5 + 0.5;
    const vignetteAlpha = 0.05 + beatPulse * 0.08 * (0.3 + scoreIntensity * 0.7);
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(0.7, `rgba(20, 10, 40, ${vignetteAlpha * 0.5})`);
    vignette.addColorStop(1, `rgba(10, 5, 30, ${vignetteAlpha})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // 3. Discovery flashes
    discoveryFlashes = discoveryFlashes.filter(flash => {
      const elapsed = now - flash.startTime;
      if (elapsed > flash.duration) return false;

      const progress = elapsed / flash.duration;
      const radius = progress * Math.max(w, h) * 0.4;
      const flashAlpha = (1 - progress) * 0.35;

      const flashGrad = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
      flashGrad.addColorStop(0, `rgba(255, 245, 200, ${flashAlpha})`);
      flashGrad.addColorStop(0.3, `rgba(255, 220, 100, ${flashAlpha * 0.5})`);
      flashGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flashGrad;
      ctx.fillRect(0, 0, w, h);
      return true;
    });

    // 4. Discovery burst particles
    discoveryParticles = discoveryParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= 0.025;
      if (p.life <= 0) return false;

      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.life * 0.8})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
  }
}
