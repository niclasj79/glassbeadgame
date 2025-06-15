
export interface SphericalArenaProps {
  disciplines: any[];
  selectedDisciplines: string[];
  concepts: Concept[];
  onConceptInteraction: (conceptId: string, action: string) => void;
  onSessionEnd: () => void;
}

export interface Concept {
  id: string;
  text: string;
  discipline: string;
  x: number;
  y: number;
  z: number;
  energy: number;
  connections: string[];
}

export interface TouchInfo {
  id: number;
  x: number;
  y: number;
}

export interface MouseRef {
  x: number;
  y: number;
  isDown: boolean;
  touchId?: number;
  activeTouches: TouchInfo[];
  twoFingerRotation: boolean;
}

export interface RotationRef {
  x: number;
  y: number;
}

export interface DragState {
  isDragging: boolean;
  conceptId: string | null;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  sphereX?: number;
  sphereY?: number;
  sphereZ?: number;
  touchDragMode: boolean;
}

export type InteractionMode = 'idle' | 'rotating' | 'selecting' | 'dragging' | 'two-finger-rotating';

export interface DimensionalMapping {
  x: { label: string; description: string };
  y: { label: string; description: string };
  z: { label: string; description: string };
}
