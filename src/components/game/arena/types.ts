
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

export interface MouseRef {
  x: number;
  y: number;
  isDown: boolean;
  touchId?: number;
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
}

export type InteractionMode = 'idle' | 'rotating' | 'selecting' | 'dragging';
