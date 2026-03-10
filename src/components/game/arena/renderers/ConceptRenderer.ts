import { Concept, DragState, RotationRef } from '../types';
import { hexToRgb, project3DTo2D, rotatePoint } from '../utils';

// Trail buffer for drag effects
const trailBuffer: Map<string, { x: number; y: number; alpha: number }[]> = new Map();

export class ConceptRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    concepts: Concept[],
    disciplines: any[] | Record<string, any>,
    selectedConcept: string | null,
    dragState: DragState,
    rotationRef: React.MutableRefObject<RotationRef>,
    hoveredConcept?: string | null,
    zoom: number = 1
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
      const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas, zoom);

      if (projected.scale < 0.2) return;

      // Idle bobbing animation
      const bobX = Math.sin(t * 1.2 + concept.energy * 7) * 2 * projected.scale;
      const bobY = Math.cos(t * 0.9 + concept.energy * 5) * 2.5 * projected.scale;

      let finalX = projected.x + bobX;
      let finalY = projected.y + bobY;

      const isDragged = dragState.isDragging && dragState.conceptId === concept.id;
      if (isDragged) {
        finalX = projected.x + dragState.offsetX;
        finalY = projected.y + dragState.offsetY;

        // Update trail buffer
        const trail = trailBuffer.get(concept.id) || [];
        trail.unshift({ x: finalX, y: finalY, alpha: 1 });
        if (trail.length > 10) trail.pop();
        trailBuffer.set(concept.id, trail);
      } else {
        // Fade trails
        const trail = trailBuffer.get(concept.id);
        if (trail) {
          trail.forEach(p => p.alpha *= 0.85);
          if (trail.length > 0 && trail[trail.length - 1].alpha < 0.05) {
            trailBuffer.delete(concept.id);
          }
        }
      }

      // Depth-based alpha
      const depthAlpha = Math.max(0.35, Math.min(1, (projected.scale - 0.2) / 0.6));

      // Render drag trail
      const trail = trailBuffer.get(concept.id);
      if (trail && trail.length > 1) {
        const rgb = hexToRgb(discipline.color);
        for (let i = 1; i < trail.length; i++) {
          const p = trail[i];
          const trailSize = (28 + concept.energy * 16 * projected.scale) * (1 - i / trail.length) * 0.6;
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ConceptRenderer.renderGlassBead(
        ctx, concept, discipline, finalX, finalY, projected.scale,
        selectedConcept === concept.id,
        isDragged,
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
    // Much larger beads + constant gentle pulse
    const basePulse = Math.sin(t * 1.5 + concept.energy * 3) * 0.08 + 1;
    const baseSize = (28 + concept.energy * 16) * scale * basePulse;
    const rgb = hexToRgb(discipline.color);

    ctx.save();

    // Outer glow halo - larger and brighter
    const haloSize = baseSize * 3.0 * (1 + Math.sin(t * 2 + concept.energy * 5) * 0.1);
    const haloGradient = ctx.createRadialGradient(x, y, baseSize * 0.5, x, y, haloSize);
    haloGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.4})`);
    haloGradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.15})`);
    haloGradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.05})`);
    haloGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    ctx.fillStyle = haloGradient;
    ctx.beginPath();
    ctx.arc(x, y, haloSize, 0, Math.PI * 2);
    ctx.fill();

    // Glass bead base - vivid saturated colors
    const gradient = ctx.createRadialGradient(
      x - baseSize * 0.3, y - baseSize * 0.3, 0,
      x, y, baseSize
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
    gradient.addColorStop(0.2, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.85})`);
    gradient.addColorStop(0.55, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.9})`);
    gradient.addColorStop(1, `rgba(${Math.floor(rgb.r * 0.6)}, ${Math.floor(rgb.g * 0.6)}, ${Math.floor(rgb.b * 0.6)}, ${alpha * 0.95})`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, baseSize, 0, Math.PI * 2);
    ctx.fill();

    // Colored rim light - thicker
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.7})`;
    ctx.lineWidth = 2;
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

    // Bright specular dot
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(x - baseSize * 0.3, y - baseSize * 0.3, baseSize * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Inner energy glow - always visible now (constant pulse)
    const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, baseSize * 0.7);
    const energyAlpha = Math.max(0.15, concept.energy * 0.5);
    innerGlow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * energyAlpha})`);
    innerGlow.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(x, y, baseSize * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Discipline icon inside bead - larger
    if (scale > 0.4) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.font = `${Math.floor(18 * scale)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(discipline.icon || '', x, y);
    }

    // Concept label
    if (scale > 0.35) {
      const fontSize = Math.floor(14 * scale);
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textY = y + baseSize + 18;
      const text = concept.text;

      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.roundRect(x - textWidth / 2 - 6, textY - fontSize / 2 - 3, textWidth + 12, fontSize + 6, 4);
      ctx.fill();

      ctx.fillStyle = `rgba(${Math.min(255, rgb.r * 0.3 + 210)}, ${Math.min(255, rgb.g * 0.3 + 210)}, ${Math.min(255, rgb.b * 0.3 + 210)}, ${alpha * 0.97})`;
      ctx.fillText(text, x, textY);
    }

    // Hover tooltip
    if (isHovered && scale > 0.25) {
      const tooltipY = y - baseSize - 16;
      const tooltipText = discipline.name;
      const fontSize = Math.floor(12 * Math.max(scale, 0.6));
      ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(tooltipText).width;

      ctx.fillStyle = `rgba(0, 0, 0, 0.75)`;
      ctx.beginPath();
      ctx.roundRect(x - tw / 2 - 8, tooltipY - fontSize / 2 - 5, tw + 16, fontSize + 10, 5);
      ctx.fill();

      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)`;
      ctx.fillText(tooltipText, x, tooltipY);
    }

    // Selection / drag highlight
    if (isSelected || isDragged) {
      const selectionRadius = baseSize + 12;
      ctx.strokeStyle = isDragged
        ? `rgba(255, 220, 100, ${alpha * 0.9})`
        : `rgba(255, 255, 255, ${alpha * 0.7})`;
      ctx.lineWidth = isDragged ? 3 : 2;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -Date.now() * 0.02;
      ctx.beginPath();
      ctx.arc(x, y, selectionRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
