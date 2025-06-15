
import { Concept, RotationRef } from '../types';
import { rotatePoint, project3DTo2D } from '../utils';

export class ConnectionRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    concepts: Concept[],
    rotationRef: React.MutableRefObject<RotationRef>
  ) {
    concepts.forEach(concept => {
      concept.connections.forEach(connectionId => {
        const connectedConcept = concepts.find(c => c.id === connectionId);
        if (!connectedConcept) return;

        const rotated1 = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
        const rotated2 = rotatePoint(connectedConcept.x, connectedConcept.y, connectedConcept.z, rotationRef.current.x, rotationRef.current.y);
        
        const projected1 = project3DTo2D(rotated1.x, rotated1.y, rotated1.z, canvas);
        const projected2 = project3DTo2D(rotated2.x, rotated2.y, rotated2.z, canvas);

        const avgScale = (projected1.scale + projected2.scale) / 2;
        if (avgScale < 0.3) return;

        // Animated flow along connection
        const flow = (Date.now() * 0.003) % 1;
        const flowX = projected1.x + (projected2.x - projected1.x) * flow;
        const flowY = projected1.y + (projected2.y - projected1.y) * flow;

        // Connection line with gradient
        const gradient = ctx.createLinearGradient(projected1.x, projected1.y, projected2.x, projected2.y);
        gradient.addColorStop(0, `rgba(150, 100, 255, ${avgScale * 0.3})`);
        gradient.addColorStop(0.5, `rgba(200, 150, 255, ${avgScale * 0.6})`);
        gradient.addColorStop(1, `rgba(150, 100, 255, ${avgScale * 0.3})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(projected1.x, projected1.y);
        ctx.lineTo(projected2.x, projected2.y);
        ctx.stroke();

        // Flow particle
        ctx.fillStyle = `rgba(255, 255, 255, ${avgScale * 0.8})`;
        ctx.beginPath();
        ctx.arc(flowX, flowY, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }
}
