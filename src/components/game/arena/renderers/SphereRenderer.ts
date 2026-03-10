import { rotatePoint, project3DTo2D } from '../utils';
import { RotationRef } from '../types';

export class SphereRenderer {
  static getResponsiveRadius(canvas: HTMLCanvasElement): number {
    return Math.min(canvas.width, canvas.height) * 0.32;
  }

  static render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<RotationRef>, zoom: number = 1) {
    const sphereRadius = SphereRenderer.getResponsiveRadius(canvas) * zoom;
    const segments = 16;
    const t = Date.now() * 0.0003;

    // Outer glow - slightly brighter
    const glowGradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, sphereRadius * 0.8,
      canvas.width / 2, canvas.height / 2, sphereRadius * 1.3
    );
    glowGradient.addColorStop(0, 'hsla(260, 60%, 45%, 0.05)');
    glowGradient.addColorStop(0.5, 'hsla(260, 50%, 35%, 0.025)');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, sphereRadius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal circles - brighter wireframe
    for (let i = 1; i < segments; i++) {
      const angle = (i / segments) * Math.PI;
      const y = Math.cos(angle) * sphereRadius;
      const radius = Math.sin(angle) * sphereRadius;
      const depthFade = Math.sin(angle);

      ctx.strokeStyle = `hsla(260, 55%, 60%, ${0.08 * depthFade})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let j = 0; j <= 64; j++) {
        const a = (j / 64) * Math.PI * 2;
        const variation = Math.sin(a * 3 + t + angle * 2) * 0.03;
        const adjustedRadius = radius * (1 + variation);

        const x = Math.cos(a) * adjustedRadius;
        const z = Math.sin(a) * adjustedRadius;

        const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);

        if (j === 0) ctx.moveTo(projected.x, projected.y);
        else ctx.lineTo(projected.x, projected.y);
      }
      ctx.stroke();
    }

    // Vertical circles - brighter
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;

      ctx.strokeStyle = 'hsla(220, 55%, 60%, 0.06)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let j = 0; j <= 32; j++) {
        const a = (j / 32) * Math.PI;
        const y = Math.cos(a) * sphereRadius;
        const radius = Math.sin(a) * sphereRadius;
        const variation = Math.sin(a * 2 + angle * 3 + t) * 0.02;
        const adjustedRadius = radius * (1 + variation);

        const x = Math.cos(angle) * adjustedRadius;
        const z = Math.sin(angle) * adjustedRadius;

        const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);

        if (j === 0) ctx.moveTo(projected.x, projected.y);
        else ctx.lineTo(projected.x, projected.y);
      }
      ctx.stroke();
    }
  }
}
