import { Concept, RotationRef } from '../types';
import { rotatePoint, project3DTo2D, hexToRgb } from '../utils';

export class ConnectionRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    concepts: Concept[],
    rotationRef: React.MutableRefObject<RotationRef>
  ) {
    const t = Date.now() * 0.001;

    // Render explicit connections
    concepts.forEach(concept => {
      concept.connections.forEach(connectionId => {
        const connected = concepts.find(c => c.id === connectionId);
        if (!connected) return;

        const r1 = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
        const r2 = rotatePoint(connected.x, connected.y, connected.z, rotationRef.current.x, rotationRef.current.y);
        const p1 = project3DTo2D(r1.x, r1.y, r1.z, canvas);
        const p2 = project3DTo2D(r2.x, r2.y, r2.z, canvas);

        const avgScale = (p1.scale + p2.scale) / 2;
        const opacity = Math.max(0.08, avgScale * 0.5);

        const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
        gradient.addColorStop(0, `rgba(150, 120, 255, ${opacity * 0.4})`);
        gradient.addColorStop(0.5, `rgba(180, 150, 255, ${opacity * 0.7})`);
        gradient.addColorStop(1, `rgba(150, 120, 255, ${opacity * 0.4})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = Math.max(0.8, 1.5 * avgScale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Flow particle
        if (avgScale > 0.3) {
          const flow = (t * 0.3) % 1;
          const fx = p1.x + (p2.x - p1.x) * flow;
          const fy = p1.y + (p2.y - p1.y) * flow;
          ctx.fillStyle = `rgba(220, 200, 255, ${opacity * 0.6})`;
          ctx.beginPath();
          ctx.arc(fx, fy, Math.max(1, 2 * avgScale), 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });
  }

  /**
   * Render a glowing proximity bridge between two concepts that are close together.
   * Called by the proximity synthesis system.
   */
  static renderProximityBridge(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    c1: Concept, c2: Concept,
    proximity: number, // 0-1, 1 = very close
    discipline1Color: string, discipline2Color: string,
    rotationRef: React.MutableRefObject<RotationRef>
  ) {
    const r1 = rotatePoint(c1.x, c1.y, c1.z, rotationRef.current.x, rotationRef.current.y);
    const r2 = rotatePoint(c2.x, c2.y, c2.z, rotationRef.current.x, rotationRef.current.y);
    const p1 = project3DTo2D(r1.x, r1.y, r1.z, canvas);
    const p2 = project3DTo2D(r2.x, r2.y, r2.z, canvas);

    const t = Date.now() * 0.003;
    const pulse = Math.sin(t) * 0.3 + 0.7;
    const baseOpacity = proximity * 0.8 * pulse;

    const rgb1 = hexToRgb(discipline1Color);
    const rgb2 = hexToRgb(discipline2Color);

    // Glowing bridge line
    const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
    gradient.addColorStop(0, `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${baseOpacity})`);
    gradient.addColorStop(0.3, `rgba(255, 220, 100, ${baseOpacity * 0.9})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 200, ${baseOpacity})`);
    gradient.addColorStop(0.7, `rgba(255, 220, 100, ${baseOpacity * 0.9})`);
    gradient.addColorStop(1, `rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, ${baseOpacity})`);

    // Outer glow
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 6 * proximity;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Core line
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2 * proximity;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Sparkle particles along the bridge
    const numParticles = Math.floor(proximity * 5);
    for (let i = 0; i < numParticles; i++) {
      const progress = (t * 0.2 + i / numParticles) % 1;
      const px = p1.x + (p2.x - p1.x) * progress;
      const py = p1.y + (p2.y - p1.y) * progress;
      const sparkleSize = 2 + Math.sin(t + i) * 1;

      ctx.fillStyle = `rgba(255, 240, 180, ${baseOpacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(px, py, sparkleSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
