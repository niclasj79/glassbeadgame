
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

      ConceptRenderer.renderGlassBead(
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

  private static renderGlassBead(
    ctx: CanvasRenderingContext2D,
    concept: Concept,
    discipline: any,
    x: number,
    y: number,
    scale: number,
    isSelected: boolean,
    isDragged: boolean
  ) {
    const alpha = Math.max(0.6, scale);
    const baseSize = 12 + concept.energy * 6 * scale;
    const rgb = hexToRgb(discipline.color);
    
    ctx.save();
    
    // Glass bead base - translucent sphere
    const gradient = ctx.createRadialGradient(
      x - baseSize * 0.3, y - baseSize * 0.3, 0,
      x, y, baseSize
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`); // Highlight
    gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.7})`); // Main color
    gradient.addColorStop(0.7, `rgba(${rgb.r * 0.7}, ${rgb.g * 0.7}, ${rgb.b * 0.7}, ${alpha * 0.8})`); // Darker edge
    gradient.addColorStop(1, `rgba(${rgb.r * 0.4}, ${rgb.g * 0.4}, ${rgb.b * 0.4}, ${alpha * 0.9})`); // Dark rim
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, baseSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Glass reflection highlight
    const highlightGradient = ctx.createRadialGradient(
      x - baseSize * 0.4, y - baseSize * 0.4, 0,
      x - baseSize * 0.4, y - baseSize * 0.4, baseSize * 0.6
    );
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
    highlightGradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.3})`);
    highlightGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
    
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(x - baseSize * 0.3, y - baseSize * 0.3, baseSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Glass specular highlight (small bright spot)
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(x - baseSize * 0.35, y - baseSize * 0.35, baseSize * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    // Subtle inner glow for energy
    if (concept.energy > 0.3) {
      const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, baseSize * 0.8);
      innerGlow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * concept.energy * 0.3})`);
      innerGlow.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Shadow beneath the bead
    const shadowGradient = ctx.createRadialGradient(
      x, y + baseSize * 0.8, 0,
      x, y + baseSize * 0.8, baseSize * 0.8
    );
    shadowGradient.addColorStop(0, `rgba(0, 0, 0, ${alpha * 0.3})`);
    shadowGradient.addColorStop(1, `rgba(0, 0, 0, 0)`);
    
    ctx.fillStyle = shadowGradient;
    ctx.beginPath();
    ctx.arc(x, y + baseSize * 0.8, baseSize * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Concept text with glass-like styling
    if (scale > 0.6) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.font = `bold ${Math.floor(12 * scale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const textY = y + baseSize + 18;
      ctx.strokeText(concept.text, x, textY);
      ctx.fillText(concept.text, x, textY);
    }

    // Selection highlight for glass bead
    if (isSelected || isDragged) {
      const selectionRadius = baseSize + 8;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * (isDragged ? 0.9 : 0.6)})`;
      ctx.lineWidth = isDragged ? 3 : 2;
      ctx.setLineDash([8, 4]);
      ctx.lineDashOffset = Date.now() * 0.01;
      ctx.beginPath();
      ctx.arc(x, y, selectionRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    ctx.restore();
  }
}
