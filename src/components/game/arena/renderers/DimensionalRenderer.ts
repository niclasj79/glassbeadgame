import { RotationRef, DimensionalMapping } from '../types';
import { rotatePoint, project3DTo2D } from '../utils';
import { SphereRenderer } from './SphereRenderer';

export class DimensionalRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    rotationRef: React.MutableRefObject<RotationRef>,
    dimensionalMapping: DimensionalMapping,
    zoom: number = 1
  ) {
    const sphereRadius = SphereRenderer.getResponsiveRadius(canvas);
    
    // Render axis lines
    this.renderAxisLines(ctx, canvas, rotationRef, sphereRadius, zoom);
    
    // Render dimensional labels
    this.renderDimensionalLabels(ctx, canvas, rotationRef, sphereRadius, dimensionalMapping, zoom);
    
    // Render subtle grid
    this.renderSphereGrid(ctx, canvas, rotationRef, sphereRadius, zoom);
  }

  private static renderAxisLines(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    rotationRef: React.MutableRefObject<RotationRef>,
    radius: number,
    zoom: number
  ) {
    const axes = [
      { dir: [-1, 0, 0], dirEnd: [1, 0, 0], color: 'rgba(255, 100, 100, 0.6)' },
      { dir: [0, -1, 0], dirEnd: [0, 1, 0], color: 'rgba(100, 255, 100, 0.6)' },
      { dir: [0, 0, -1], dirEnd: [0, 0, 1], color: 'rgba(100, 100, 255, 0.6)' }
    ];

    const segments = 32;
    axes.forEach(axis => {
      ctx.strokeStyle = axis.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * 2 - 1; // -1 to 1
        const x = t * radius * (axis.dir[0] !== 0 ? 1 : 0) + t * radius * (axis.dirEnd[0] !== 0 && axis.dir[0] === 0 ? 0 : 0);
        const px = t * radius * axis.dirEnd[0];
        const py = t * radius * axis.dirEnd[1];
        const pz = t * radius * axis.dirEnd[2];
        const rotated = rotatePoint(px, py, pz, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas, zoom);
        if (i === 0) ctx.moveTo(projected.x, projected.y);
        else ctx.lineTo(projected.x, projected.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  private static renderDimensionalLabels(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    rotationRef: React.MutableRefObject<RotationRef>,
    radius: number,
    mapping: DimensionalMapping,
    zoom: number
  ) {
    const labels = [
      { pos: [radius + 20, 0, 0], text: mapping.x.positive, color: 'rgba(255, 150, 150, 0.8)' },
      { pos: [-radius - 20, 0, 0], text: mapping.x.negative, color: 'rgba(255, 150, 150, 0.8)' },
      { pos: [0, radius + 20, 0], text: mapping.y.positive, color: 'rgba(150, 255, 150, 0.8)' },
      { pos: [0, -radius - 20, 0], text: mapping.y.negative, color: 'rgba(150, 255, 150, 0.8)' },
      { pos: [0, 0, radius + 20], text: mapping.z.positive, color: 'rgba(150, 150, 255, 0.8)' },
      { pos: [0, 0, -radius - 20], text: mapping.z.negative, color: 'rgba(150, 150, 255, 0.8)' }
    ];

    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach(label => {
      const rotated = rotatePoint(label.pos[0], label.pos[1], label.pos[2], rotationRef.current.x, rotationRef.current.y);
      
      if (rotated.z > -100) { // Only show labels that are reasonably visible
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas, zoom);
        
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, projected.x, projected.y);
      }
    });
  }

  private static renderSphereGrid(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    rotationRef: React.MutableRefObject<RotationRef>,
    radius: number,
    zoom: number
  ) {
    const gridLines = 8;
    
    // Meridian lines (longitude)
    for (let i = 0; i < gridLines; i++) {
      const angle = (i / gridLines) * Math.PI * 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let j = 0; j <= 20; j++) {
        const theta = (j / 20) * Math.PI;
        const x = radius * Math.sin(theta) * Math.cos(angle);
        const y = radius * Math.cos(theta);
        const z = radius * Math.sin(theta) * Math.sin(angle);
        
        const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas, zoom);
        
        if (j === 0) {
          ctx.moveTo(projected.x, projected.y);
        } else {
          ctx.lineTo(projected.x, projected.y);
        }
      }
      ctx.stroke();
    }
    
    // Parallel lines (latitude)
    for (let i = 1; i < gridLines; i++) {
      const theta = (i / gridLines) * Math.PI;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let j = 0; j <= 40; j++) {
        const angle = (j / 40) * Math.PI * 2;
        const x = radius * Math.sin(theta) * Math.cos(angle);
        const y = radius * Math.cos(theta);
        const z = radius * Math.sin(theta) * Math.sin(angle);
        
        const rotated = rotatePoint(x, y, z, rotationRef.current.x, rotationRef.current.y);
        const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas, zoom);
        
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
