import { Concept, DragState, RotationRef } from '../types';
import { hexToRgb, project3DTo2D, rotatePoint } from '../utils';

export class ConceptRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    concepts: Concept[],
    disciplines: any[] | Record<string, any>,
    selectedConcept: string | null,
    dragState: DragState,
    rotationRef: React.MutableRefObject<RotationRef>,
    hoveredConcept?: string | null
  ) {
    const getDiscipline = (id: string) => {
      if (Array.isArray(disciplines)) return disciplines.find(d => d.id === id);
      return (disciplines as Record<string, any>)[id];
    };

    const sortedConcepts = [...concepts].sort((a, b) => {
      const rotatedA = rotatePoint(a.x, a.y, a.z, rotationRef.current.x, rotationRef.current.y);
      const rotatedB = rotatePoint(b.x, b.y, b.z, rotationRef.current.x, rotationRef.current.y);
      return rotatedB.z - rotatedA.z;
    });

    const t = Date.now() * 0.001;

    sortedConcepts.forEach(concept => {
      const discipline = getDiscipline(concept.discipline);
      if (!discipline) return;

      const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
      const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);

      if (projected.scale < 0.2) return;

      let finalX = projected.x;
      let finalY = projected.y;

      if (dragState.isDragging && dragState.conceptId === concept.id) {
        finalX += dragState.offsetX;
        finalY += dragState.offsetY;
      }

      // Depth-based alpha: back beads fade out
      const depthAlpha = Math.max(0.35, Math.min(1, (projected.scale - 0.2) / 0.6));

      ConceptRenderer.renderGlassBead(
        ctx, concept, discipline, finalX, finalY, projected.scale,
        selectedConcept === concept.id,
        dragState.isDragging && dragState.conceptId === concept.id,
        hoveredConcept === concept.id,
        depthAlpha, t
      );
    });
  }

  private static renderGlassBead(
    ctx: CanvasRenderingContext2D,
    concept: Concept,
    discipline: any,
    x: number, y: number, scale: number,
    isSelected: boolean, isDragged: boolean,
    isHovered: boolean,
    depthAlpha: number,
    t: number
  ) {
    const alpha = depthAlpha;
    const baseSize = 18 + concept.energy * 12 * scale; // Larger beads
    const rgb = hexToRgb(discipline.color);
    const pulse = Math.sin(t * 2 + concept.energy * 5) * 0.1 + 1;

    ctx.save();

    // Outer glow halo - brighter
    const haloSize = baseSize * 2.4 * pulse;
    const haloGradient = ctx.createRadialGradient(x, y, baseSize * 0.5, x, y, haloSize);
    haloGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.35})`);
    haloGradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.12})`);
    haloGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(x, y, haloSize, 0, Math.PI * 2);
    ctx.fill();

    // Glass bead base - more saturated colors
    const gradient = ctx.createRadialGradient(
      x - baseSize * 0.3, y - baseSize * 0.3, 0,
      x, y, baseSize
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.85})`);
    gradient.addColorStop(0.25, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.8})`);
    gradient.addColorStop(0.6, `rgba(${Math.floor(rgb.r * 0.8)}, ${Math.floor(rgb.g * 0.8)}, ${Math.floor(rgb.b * 0.8)}, ${alpha * 0.85})`);
    gradient.addColorStop(1, `rgba(${Math.floor(rgb.r * 0.5)}, ${Math.floor(rgb.g * 0.5)}, ${Math.floor(rgb.b * 0.5)}, ${alpha * 0.95})`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, baseSize, 0, Math.PI * 2);
    ctx.fill();

    // Colored rim light
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, baseSize, 0, Math.PI * 2);
    ctx.stroke();

    // Glass reflection highlight
    const highlightGradient = ctx.createRadialGradient(
      x - baseSize * 0.35, y - baseSize * 0.35, 0,
      x - baseSize * 0.35, y - baseSize * 0.35, baseSize * 0.55
    );
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
    highlightGradient.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.3})`);
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(x - baseSize * 0.25, y - baseSize * 0.25, baseSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Bright specular
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(x - baseSize * 0.3, y - baseSize * 0.3, baseSize * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Inner energy glow
    if (concept.energy > 0.2) {
      const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, baseSize * 0.7);
      innerGlow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * concept.energy * 0.5})`);
      innerGlow.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.arc(x, y, baseSize * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Discipline icon inside bead
    if (scale > 0.45) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.75})`;
      ctx.font = `${Math.floor(15 * scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(discipline.icon || '', x, y);
    }

    // Concept label - always visible when scale > 0.4
    if (scale > 0.4) {
      const fontSize = Math.floor(13 * scale);
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textY = y + baseSize + 16;
      const text = concept.text;

      // Text background for legibility
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.roundRect(x - textWidth / 2 - 4, textY - fontSize / 2 - 2, textWidth + 8, fontSize + 4, 3);
      ctx.fill();

      // Main text - brighter
      ctx.fillStyle = `rgba(${Math.min(255, rgb.r * 0.3 + 200)}, ${Math.min(255, rgb.g * 0.3 + 200)}, ${Math.min(255, rgb.b * 0.3 + 200)}, ${alpha * 0.95})`;
      ctx.fillText(text, x, textY);
    }

    // Hover tooltip with discipline name
    if (isHovered && scale > 0.3) {
      const tooltipY = y - baseSize - 14;
      const tooltipText = `${discipline.name}`;
      const fontSize = Math.floor(11 * Math.max(scale, 0.6));
      ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(tooltipText).width;

      ctx.fillStyle = `rgba(0, 0, 0, 0.7)`;
      ctx.beginPath();
      ctx.roundRect(x - tw / 2 - 6, tooltipY - fontSize / 2 - 4, tw + 12, fontSize + 8, 4);
      ctx.fill();

      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)`;
      ctx.fillText(tooltipText, x, tooltipY);
    }

    // Selection / drag highlight
    if (isSelected || isDragged) {
      const selectionRadius = baseSize + 10;
      ctx.strokeStyle = isDragged
        ? `rgba(255, 220, 100, ${alpha * 0.9})`
        : `rgba(255, 255, 255, ${alpha * 0.7})`;
      ctx.lineWidth = isDragged ? 2.5 : 1.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -Date.now() * 0.015;
      ctx.beginPath();
      ctx.arc(x, y, selectionRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
