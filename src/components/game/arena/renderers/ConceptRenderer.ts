
import { Concept, DragState, RotationRef } from '../types';
import { hexToRgb, project3DTo2D, rotatePoint } from '../utils';

export class ConceptRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    concepts: Concept[],
    disciplines: any[],
    selectedConcept: string | null,
    dragState: DragState,
    rotationRef: React.MutableRefObject<RotationRef>
  ) {
    // Sort concepts by depth for proper rendering order
    const sortedConcepts = [...concepts].sort((a, b) => {
      const rotatedA = rotatePoint(a.x, a.y, a.z, rotationRef.current.x, rotationRef.current.y);
      const rotatedB = rotatePoint(b.x, b.y, b.z, rotationRef.current.x, rotationRef.current.y);
      return rotatedB.z - rotatedA.z;
    });

    sortedConcepts.forEach(concept => {
      const discipline = disciplines.find(d => d.id === concept.discipline);
      if (!discipline) return;

      const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
      const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
      
      if (projected.scale < 0.3) return;

      // Apply drag offset if this concept is being dragged
      let finalX = projected.x;
      let finalY = projected.y;
      
      if (dragState.isDragging && dragState.conceptId === concept.id) {
        finalX += dragState.offsetX;
        finalY += dragState.offsetY;
      }

      ConceptRenderer.renderSingleConcept(
        ctx, 
        concept, 
        discipline, 
        finalX, 
        finalY, 
        projected.scale, 
        selectedConcept === concept.id,
        dragState.isDragging && dragState.conceptId === concept.id
      );
    });
  }

  private static renderSingleConcept(
    ctx: CanvasRenderingContext2D,
    concept: Concept,
    discipline: any,
    x: number,
    y: number,
    scale: number,
    isSelected: boolean,
    isDragged: boolean
  ) {
    const alpha = Math.max(0.4, scale);
    const baseSize = 6 + concept.energy * 8 * scale;
    const pulseSize = baseSize + Math.sin(Date.now() * 0.003 + concept.energy * 10) * 2;
    
    const rgb = hexToRgb(discipline.color);
    
    // Enhanced glow for dragged concepts
    const glowMultiplier = isDragged ? 1.5 : 1;
    
    // Render glow layers
    for (let layer = 3; layer >= 0; layer--) {
      const layerAlpha = alpha * (0.3 - layer * 0.05) * glowMultiplier;
      const layerSize = (pulseSize + layer * 8) * (isDragged ? 1.2 : 1);
      
      const gradient = ctx.createRadialGradient(
        x, y, 0,
        x, y, layerSize
      );
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerAlpha})`);
      gradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerAlpha * 0.5})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, layerSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Concept core
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(x, y, pulseSize * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Orbital particles
    for (let p = 0; p < 3; p++) {
      const particleAngle = (Date.now() * 0.001 + p * 2.1) % (Math.PI * 2);
      const particleRadius = pulseSize + 15 + Math.sin(Date.now() * 0.002 + p) * 5;
      const particleX = x + Math.cos(particleAngle) * particleRadius;
      const particleY = y + Math.sin(particleAngle) * particleRadius;
      
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(particleX, particleY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Concept text with enhanced styling
    if (scale > 0.6) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.font = `${Math.floor(14 * scale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.shadowColor = discipline.color;
      ctx.shadowBlur = 8;
      ctx.fillText(concept.text, x, y + pulseSize + 20);
      ctx.shadowBlur = 0;
    }

    // Enhanced selection highlight
    if (isSelected || isDragged) {
      const selectionRadius = pulseSize + 10 + Math.sin(Date.now() * 0.005) * 3;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * (isDragged ? 1 : 0.8)})`;
      ctx.lineWidth = isDragged ? 3 : 2;
      ctx.setLineDash(isDragged ? [8, 4] : [5, 5]);
      ctx.lineDashOffset = Date.now() * 0.01;
      ctx.beginPath();
      ctx.arc(x, y, selectionRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
