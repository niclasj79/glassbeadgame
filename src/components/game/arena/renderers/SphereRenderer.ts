
import { rotatePoint, project3DTo2D } from '../utils';
import { RotationRef } from '../types';

export class SphereRenderer {
  static render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<RotationRef>) {
    // Draw organic, flowing sphere wireframe
    ctx.strokeStyle = 'rgba(120, 80, 200, 0.15)';
    ctx.lineWidth = 1;
    
    const sphereRadius = 200;
    const segments = 12;
    
    // Horizontal circles
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI;
      const y = Math.cos(angle) * sphereRadius;
      const radius = Math.sin(angle) * sphereRadius;
      
      ctx.beginPath();
      for (let j = 0; j <= 48; j++) {
        const a = (j / 48) * Math.PI * 2;
        const variation = Math.sin(a * 3 + angle * 2) * 0.05 + Math.sin(a * 7) * 0.02;
        const adjustedRadius = radius * (1 + variation);
        
        const x = Math.cos(a) * adjustedRadius;
        const z = Math.sin(a) * adjustedRadius;
        
        const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
        
        if (j === 0) {
          ctx.moveTo(projected.x, projected.y);
        } else {
          ctx.lineTo(projected.x, projected.y);
        }
      }
      ctx.stroke();
    }
    
    // Vertical circles
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      
      ctx.beginPath();
      for (let j = 0; j <= 24; j++) {
        const a = (j / 24) * Math.PI;
        const y = Math.cos(a) * sphereRadius;
        const radius = Math.sin(a) * sphereRadius;
        
        const variation = Math.sin(a * 2 + angle * 3) * 0.03;
        const adjustedRadius = radius * (1 + variation);
        
        const x = Math.cos(angle) * adjustedRadius;
        const z = Math.sin(angle) * adjustedRadius;
        
        const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
        
        if (j === 0) {
          ctx.moveTo(projected.x, projected.y);
        } else {
          ctx.lineTo(projected.x, projected.y);
        }
      }
      ctx.stroke();
    }
  }
}
